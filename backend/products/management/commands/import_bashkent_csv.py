"""
Импорт номенклатуры и остатков из CSV «Башкент Дилмурод»:
- Меню: Код материала, Наименование, Ед. изм, Фирма → Product (SKU, описание = фирма)
- Остаток: те же + колонки движения; конечный остаток (кол-во, сумма) → StockBalance, Product.amount
"""
import csv
from decimal import Decimal, InvalidOperation
from pathlib import Path

from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from products.bashkent_supplement import run_bashkent_supplement
from products.models import Product
from stock.models import StockBalance
from warehouse.models import Cell, Rack, Warehouse, Zone


def _parse_decimal(val) -> Decimal:
    if val is None:
        return Decimal("0")
    t = str(val).strip()
    if not t:
        return Decimal("0")
    t = t.replace("\xa0", "").replace("\u202f", "").replace(" ", "")
    t = t.replace(",", ".")
    if t in ("-", "—"):
        return Decimal("0")
    try:
        return Decimal(t)
    except InvalidOperation:
        return Decimal("0")


def _read_menu_rows(path: Path):
    with path.open(encoding="utf-8-sig", newline="") as f:
        rows = list(csv.reader(f))
    header_idx = None
    for i, row in enumerate(rows):
        if len(row) > 1 and row[1].strip() == "Код материала":
            header_idx = i
            break
    if header_idx is None:
        raise CommandError(f"В {path} не найдена строка заголовка с «Код материала».")
    out = {}
    for row in rows[header_idx + 1 :]:
        if len(row) < 4:
            continue
        sku = (row[1] or "").strip()
        if not sku or sku == "Код материала":
            continue
        name = (row[2] or "").strip()
        unit = (row[3] or "шт").strip()[:20]
        firm = (row[4] or "").strip() if len(row) > 4 else ""
        out[sku] = {"name": name or sku, "unit": unit or "шт", "firm": firm}
    return out


def _read_ostatok_rows(path: Path):
    with path.open(encoding="utf-8-sig", newline="") as f:
        rows = list(csv.reader(f))
    header_idx = None
    for i, row in enumerate(rows):
        if len(row) > 1 and row[1].strip() == "Код материала":
            header_idx = i
            break
    if header_idx is None:
        raise CommandError(f"В {path} не найдена строка заголовка с «Код материала».")
    # строка под заголовком — подписи «Кол-во»; данные после неё
    data_start = header_idx + 2
    out = {}
    for row in rows[data_start:]:
        if len(row) < 14:
            continue
        sku = (row[1] or "").strip()
        if not sku or sku == "Код материала":
            continue
        name = (row[2] or "").strip()
        unit = (row[3] or "шт").strip()[:20]
        out[sku] = {
            "name": name or sku,
            "unit": unit or "шт",
            "qty": _parse_decimal(row[11]),
            "amount": _parse_decimal(row[13]),
        }
    return out


class Command(BaseCommand):
    help = (
        "Очистить БД (flush), затем импортировать Меню.csv и Остаток.csv "
        "(номенклатура + остаток в одной ячейке «Сводный остаток»). "
        "После импорта автоматически дополняются справочники (единицы, категория «Товары и материалы», "
        "поставщики, объект, штрихкод). "
        "Флаг --generate-placeholders создаёт PNG-карточки (название+SKU) для товаров без фото. "
        "Пользователей не создаёт."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--menu",
            type=str,
            default="БАШКЕНТ ДИЛМУРОД - Меню.csv",
            help="Путь к CSV «Меню» (от корня репозитория или абсолютный).",
        )
        parser.add_argument(
            "--ostatok",
            type=str,
            default="БАШКЕНТ ДИЛМУРОД - Остаток.csv",
            help="Путь к CSV «Остаток».",
        )
        parser.add_argument(
            "--repo-root",
            type=str,
            default="",
            help="Корень репозитория для относительных путей (по умолчанию: родитель каталога backend).",
        )
        parser.add_argument(
            "--no-flush",
            action="store_true",
            help="Не вызывать flush (только импорт; возможны конфликты SKU).",
        )
        parser.add_argument(
            "--warehouse-name",
            type=str,
            default="Башкент Дилмурод",
            help="Название склада для сводного остатка.",
        )
        parser.add_argument(
            "--no-supplement",
            action="store_true",
            help="Не вызывать дополнение справочников (единицы, категории, поставщики и т.д.).",
        )
        parser.add_argument(
            "--generate-placeholders",
            action="store_true",
            help="После импорта сгенерировать PNG-карточки (название + SKU) для товаров без фото.",
        )

    def handle(self, *args, **options):
        repo_root = options["repo_root"]
        if not repo_root:
            repo_root = Path(__file__).resolve().parent.parent.parent.parent.parent
        else:
            repo_root = Path(repo_root)

        menu_path = Path(options["menu"])
        if not menu_path.is_absolute():
            menu_path = repo_root / menu_path
        ostatok_path = Path(options["ostatok"])
        if not ostatok_path.is_absolute():
            ostatok_path = repo_root / ostatok_path

        if not menu_path.is_file():
            raise CommandError(f"Файл не найден: {menu_path}")
        if not ostatok_path.is_file():
            raise CommandError(f"Файл не найден: {ostatok_path}")

        menu_map = _read_menu_rows(menu_path)
        ostatok_map = _read_ostatok_rows(ostatok_path)
        self.stdout.write(f"Меню: позиций {len(menu_map)}, Остаток: позиций {len(ostatok_map)}")

        all_skus = set(menu_map) | set(ostatok_map)

        if not options["no_flush"]:
            self.stdout.write("Очистка БД (flush)...")
            call_command("flush", interactive=False, verbosity=0)
            call_command("migrate", interactive=False, verbosity=0)
            call_command("create_roles", verbosity=0)

        with transaction.atomic():
            wh_name = options["warehouse_name"]
            warehouse, _ = Warehouse.objects.get_or_create(
                name=wh_name,
                defaults={"address": "", "is_active": True},
            )
            zone, _ = Zone.objects.get_or_create(
                warehouse=warehouse,
                name="Основная",
                defaults={"code": "MAIN"},
            )
            rack, _ = Rack.objects.get_or_create(
                zone=zone,
                name="Ряд 1",
                defaults={"code": "R1"},
            )
            cell, _ = Cell.objects.get_or_create(
                rack=rack,
                name="Сводный остаток",
                defaults={"code": "TOTAL", "is_active": True},
            )

            created_p = updated_p = 0
            for sku in sorted(all_skus):
                m = menu_map.get(sku, {})
                o = ostatok_map.get(sku, {})
                name = m.get("name") or o.get("name") or sku
                unit = m.get("unit") or o.get("unit") or "шт"
                firm = m.get("firm", "")
                desc = f"Фирма: {firm}" if firm else ""
                amount = o.get("amount", Decimal("0"))
                qty = o.get("qty", Decimal("0"))

                obj, is_created = Product.objects.update_or_create(
                    sku=sku,
                    defaults={
                        "name": name[:255],
                        "unit": unit[:20],
                        "description": desc[:2000] if desc else "",
                        "amount": amount,
                        "barcode": "",
                        "category": None,
                        "is_active": True,
                    },
                )
                if is_created:
                    created_p += 1
                else:
                    updated_p += 1

                StockBalance.objects.update_or_create(
                    product=obj,
                    cell=cell,
                    defaults={"quantity": qty},
                )

        self.stdout.write(
            self.style.SUCCESS(
                f"Готово. Товаров создано: {created_p}, обновлено: {updated_p}. "
                f"Остатки в ячейке «{cell.name}» склада «{warehouse.name}»."
            )
        )
        if not options["no_supplement"]:
            self.stdout.write("Дополнение справочников...")
            run_bashkent_supplement(
                stdout_write=self.stdout.write,
                generate_placeholders=options["generate_placeholders"],
            )
