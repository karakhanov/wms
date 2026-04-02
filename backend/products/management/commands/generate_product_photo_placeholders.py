from django.core.management.base import BaseCommand

from products.bashkent_supplement import run_generate_product_photo_placeholders


class Command(BaseCommand):
    help = (
        "Сгенерировать PNG-карточки для товаров (название + SKU, цвет фона по SKU). "
        "По умолчанию только у товаров без фото; --force перезаписывает все."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--force",
            action="store_true",
            help="Перегенерировать даже если фото уже есть.",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=0,
            help="Максимум товаров (0 = без ограничения).",
        )

    def handle(self, *args, **options):
        lim = options["limit"]
        run_generate_product_photo_placeholders(
            self.stdout.write,
            force=options["force"],
            limit=lim if lim > 0 else None,
        )
        self.stdout.write(self.style.SUCCESS("Готово."))
