from pathlib import Path

from django.core.management.base import BaseCommand

from products.bashkent_supplement import run_bashkent_supplement


class Command(BaseCommand):
    help = (
        "Дополнить БД после импорта CSV: единицы измерения, одна номенклатурная категория "
        "«Товары и материалы», поставщики в справочнике, объект, штрихкод. "
        "Опционально: фото из каталога; PNG-заглушки (Pillow)."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--photos-dir",
            type=str,
            default="",
            help="Каталог с файлами фото: имя = SKU + расширение (.jpg, .png, …).",
        )
        parser.add_argument(
            "--generate-placeholders",
            action="store_true",
            help="Сгенерировать PNG с названием и SKU для товаров без фото (после остальных шагов).",
        )
        parser.add_argument(
            "--regenerate-placeholders",
            action="store_true",
            help="Как --generate-placeholders, но перезаписать и существующие фото.",
        )
        parser.add_argument(
            "--placeholders-limit",
            type=int,
            default=0,
            help="Ограничить число генерируемых карточек (для теста).",
        )

    def handle(self, *args, **options):
        pdir = options["photos_dir"].strip()
        photos_path = Path(pdir) if pdir else None
        lim = options["placeholders_limit"]
        run_bashkent_supplement(
            stdout_write=self.stdout.write,
            photos_dir=photos_path,
            generate_placeholders=options["generate_placeholders"]
            or options["regenerate_placeholders"],
            placeholders_force=options["regenerate_placeholders"],
            placeholders_limit=lim if lim > 0 else None,
        )
        self.stdout.write(self.style.SUCCESS("Дополнение справочников выполнено."))
