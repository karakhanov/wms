"""
Дополнение данных после импорта CSV «Башкент Дилмурод»: справочники и связи.
Поставщики — только в Supplier; категория товара — номенклатурная группа, не контрагент.
"""
import hashlib
import re
from io import BytesIO
from pathlib import Path
from typing import Callable, Optional

from django.core.files import File
from django.core.files.base import ContentFile
from django.db import transaction
from django.db.models import F, Q

from PIL import Image, ImageDraw, ImageFont

from construction.models import ConstructionObject
from products.models import Category, Product, Unit
from receipts.models import Supplier

FIRM_PREFIX = "Фирма: "

_UNIT_NAMES = {
    "шт": "Штука",
    "кг": "Килограмм",
    "тн": "Тонна (метрическая)",
    "банка": "Банка",
    "рулон": "Рулон",
    "упак": "Упаковка",
    "м": "Метр",
    "м2": "Квадратный метр",
    "м3": "Кубический метр",
    "л": "Литр",
    "компл": "Комплект",
}


def _firm_from_description(description: str):
    if not description or not description.strip():
        return None
    text = description.strip()
    if not text.startswith(FIRM_PREFIX):
        return None
    rest = text[len(FIRM_PREFIX) :].strip()
    if not rest:
        return None
    line = rest.split("\n")[0].strip()
    return line[:255] if line else None


def _attach_photos_from_dir(photos_dir: Path, log: Callable[[str], None]) -> int:
    """Подставить фото из каталога: файлы с именем <SKU>.jpg|.jpeg|.png|.webp"""
    if not photos_dir.is_dir():
        log(f"Каталог фото пропущен (нет пути): {photos_dir}")
        return 0
    exts = (".jpg", ".jpeg", ".png", ".webp")
    n = 0
    qs = Product.objects.filter(Q(photo="") | Q(photo__isnull=True))
    for p in qs.iterator(chunk_size=200):
        sku = (p.sku or "").strip()
        if not sku:
            continue
        for ext in exts:
            fp = photos_dir / f"{sku}{ext}"
            if not fp.is_file():
                continue
            try:
                with fp.open("rb") as fh:
                    p.photo.save(f"{sku}{ext}", File(fh), save=True)
                n += 1
            except OSError as e:
                log(f"Фото {fp}: {e}")
            break
    log(f"Фото из каталога подставлено: {n} товаров.")
    return n


# Пастельные фоны по SKU (узнаваемые карточки без реальных фото)
_PLACEHOLDER_BG = [
    (232, 242, 252),
    (252, 238, 232),
    (236, 252, 236),
    (248, 236, 252),
    (252, 252, 228),
    (228, 248, 252),
    (240, 236, 252),
    (252, 240, 248),
]


def _placeholder_font_paths():
    here = Path(__file__).resolve().parent
    yield here / "fonts" / "DejaVuSans.ttf"
    for p in (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    ):
        yield Path(p)


def _load_placeholder_fonts():
    """DejaVu/Liberation для кириллицы; иначе bitmap (кириллица может не отображаться)."""
    for candidate in _placeholder_font_paths():
        if candidate.is_file():
            p = str(candidate)
            return ImageFont.truetype(p, 20), ImageFont.truetype(p, 15), True
    f = ImageFont.load_default()
    return f, f, False


def _bg_for_sku(sku: str) -> tuple:
    h = int(hashlib.md5((sku or "").encode("utf-8")).hexdigest(), 16)
    return _PLACEHOLDER_BG[h % len(_PLACEHOLDER_BG)]


def _darken(rgb: tuple, factor: float = 0.72) -> tuple:
    return tuple(int(c * factor) for c in rgb)


def _text_width(draw: ImageDraw.ImageDraw, text: str, font) -> float:
    if hasattr(draw, "textlength"):
        return float(draw.textlength(text, font=font))
    bbox = draw.textbbox((0, 0), text, font=font)
    return float(bbox[2] - bbox[0])


def _wrap_title(draw: ImageDraw.ImageDraw, text: str, font, max_width: int, max_lines: int = 8):
    text = re.sub(r"\s+", " ", (text or "").strip() or "—")
    words = text.split()
    lines = []
    current: list[str] = []
    for word in words:
        trial = " ".join(current + [word])
        if _text_width(draw, trial, font) <= max_width:
            current.append(word)
            continue
        if current:
            lines.append(" ".join(current))
            current = []
            if len(lines) >= max_lines:
                break
        acc = ""
        for ch in word:
            t2 = acc + ch
            if _text_width(draw, t2, font) <= max_width:
                acc = t2
            else:
                if acc:
                    lines.append(acc)
                    acc = ch
                else:
                    lines.append(ch)
                    acc = ""
                if len(lines) >= max_lines:
                    break
        if len(lines) >= max_lines:
            break
        if acc:
            current = [acc]
    if len(lines) < max_lines and current:
        lines.append(" ".join(current))
    return lines[:max_lines]


def _line_height(font) -> int:
    return int(getattr(font, "size", 12)) + 6


def _render_product_placeholder_png(product: Product, title_font, footer_font) -> bytes:
    w, h = 440, 340
    margin = 22
    bg = _bg_for_sku(product.sku or "")
    img = Image.new("RGB", (w, h), bg)
    draw = ImageDraw.Draw(img)
    border = _darken(bg, 0.55)
    draw.rounded_rectangle((2, 2, w - 3, h - 3), radius=10, outline=border, width=2)

    inner_w = w - 2 * margin
    title_lines = _wrap_title(
        draw, (product.name or "")[:500], title_font, inner_w, max_lines=8
    )
    y = margin + 6
    text_color = (33, 43, 54)
    lh = _line_height(title_font)
    for line in title_lines:
        draw.text((margin, y), line, fill=text_color, font=title_font)
        y += lh

    fh = int(getattr(footer_font, "size", 10))
    sku_text = (product.sku or "—")[:80]
    sku_y = h - margin - fh - 18
    draw.text((margin, sku_y), sku_text, fill=(80, 102, 120), font=footer_font)

    foot = "WMS · авто"
    fw = _text_width(draw, foot, footer_font)
    draw.text((w - margin - int(fw), sku_y), foot, fill=(120, 130, 140), font=footer_font)

    buf = BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def run_generate_product_photo_placeholders(
    log: Callable[[str], None],
    *,
    force: bool = False,
    limit: Optional[int] = None,
) -> int:
    """
    PNG-карточки с названием и SKU (Pillow + TTF с кириллицей при наличии в ОС).
    """
    title_font, footer_font, has_ttf = _load_placeholder_fonts()
    if not has_ttf:
        log(
            "Предупреждение: нет DejaVu/Liberation — кириллица может отображаться квадратиками. "
            "Положите DejaVuSans.ttf в backend/products/fonts/."
        )

    qs = Product.objects.all().order_by("id")
    if not force:
        qs = qs.filter(Q(photo="") | Q(photo__isnull=True))
    if limit is not None:
        qs = qs[: int(limit)]

    n = 0
    safe_sku = re.compile(r"[^a-zA-Z0-9._-]+")

    for p in qs.iterator(chunk_size=100):
        try:
            data = _render_product_placeholder_png(p, title_font, footer_font)
            fname = f"{safe_sku.sub('_', p.sku or str(p.pk))}.png"
            p.photo.save(fname, ContentFile(data), save=True)
            n += 1
            if n % 500 == 0:
                log(f"  … сгенерировано {n} изображений")
        except OSError as e:
            log(f"Ошибка сохранения фото для {p.sku}: {e}")
    log(f"Сгенерировано изображений-товаров: {n}.")
    return n


def run_bashkent_supplement(
    stdout_write=None,
    photos_dir: Optional[Path] = None,
    *,
    generate_placeholders: bool = False,
    placeholders_force: bool = False,
    placeholders_limit: Optional[int] = None,
):
    """Идемпотентно заполняет справочники и поля товаров."""
    log = stdout_write or (lambda s: None)

    with transaction.atomic():
        # --- Единицы измерения из фактических товаров ---
        symbols = list(
            Product.objects.values_list("unit", flat=True)
            .distinct()
            .order_by("unit")
        )
        n_units = 0
        for sym in symbols:
            if not sym:
                continue
            _, c = Unit.objects.get_or_create(
                symbol=sym[:20],
                defaults={
                    "name": _UNIT_NAMES.get(sym, sym)[:255],
                    "is_active": True,
                },
            )
            if c:
                n_units += 1
        log(f"Единицы измерения: новых за шаг: {n_units}.")

        # --- Категория = номенклатура, не поставщик ---
        root, _ = Category.objects.get_or_create(
            name="Башкент Дилмурод (импорт)",
            parent=None,
            defaults={},
        )
        cat_products, _ = Category.objects.get_or_create(
            name="Товары и материалы",
            parent=root,
            defaults={},
        )
        wrong_children = Category.objects.filter(parent=root).exclude(pk=cat_products.pk)
        Product.objects.filter(category__in=wrong_children).update(category=cat_products)
        Product.objects.filter(category=root).update(category=cat_products)
        Product.objects.filter(category__isnull=True).update(category=cat_products)
        deleted, _ = wrong_children.delete()
        log(
            f"Категория товаров: «{cat_products.name}»; удалено лишних подкатегорий (контрагенты): {deleted}."
        )

        # --- Поставщики (контрагенты) — только справочник Supplier ---
        firms = set()
        for desc in Product.objects.values_list("description", flat=True):
            f = _firm_from_description(desc or "")
            if f:
                firms.add(f)

        n_sup = 0
        for firm in sorted(firms):
            _, c = Supplier.objects.get_or_create(
                name=firm[:255],
                defaults={"inn": "", "contact": ""},
            )
            if c:
                n_sup += 1
        log(f"Поставщики (контрагенты): уникальных {len(firms)}, новых за шаг: {n_sup}.")

        # --- Строительный объект по умолчанию ---
        obj, c = ConstructionObject.objects.get_or_create(
            name="Башкент Дилмурод — основной объект",
            defaults={"code": "BD-MAIN", "address": "", "is_active": True},
        )
        log(f"Строительный объект: «{obj.name}» ({'создан' if c else 'уже был'}).")

        # --- Штрихкод = SKU, если пусто ---
        updated = 0
        batch = []
        for p in Product.objects.iterator(chunk_size=500):
            if not (p.barcode or "").strip():
                p.barcode = p.sku[:100]
            batch.append(p)
            if len(batch) >= 500:
                Product.objects.bulk_update(batch, ["barcode"])
                updated += len(batch)
                batch = []
        if batch:
            Product.objects.bulk_update(batch, ["barcode"])
            updated += len(batch)
        log(f"Товары: обновлён штрихкод (где пусто): {updated}.")

    n_bar = Product.objects.filter(barcode="").update(barcode=F("sku"))
    if n_bar:
        log(f"Дозаполнено штрихкодов из SKU (SQL): {n_bar}.")

    if photos_dir is not None:
        _attach_photos_from_dir(Path(photos_dir), log)

    if generate_placeholders or placeholders_force:
        log("Генерация PNG-заглушек с названием и SKU…")
        run_generate_product_photo_placeholders(
            log,
            force=placeholders_force,
            limit=placeholders_limit,
        )

    return {}
