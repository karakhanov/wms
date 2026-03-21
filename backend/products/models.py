"""
Управление товарами: карточка товара (название, артикул SKU, штрихкод,
категория, единица измерения, описание, сумма).
"""
from django.db import models
from users.models import AuditModel


class Unit(AuditModel):
    """Справочник единиц измерения (для выпадающего списка в UI)."""
    symbol = models.CharField("Символ", max_length=20, unique=True, db_index=True)
    name = models.CharField("Название", max_length=255)
    is_active = models.BooleanField("Активна", default=True)

    class Meta:
        verbose_name = "Единица измерения"
        verbose_name_plural = "Единицы измерения"

    def __str__(self):
        return f"{self.name} ({self.symbol})"


class Category(AuditModel):
    """Категория номенклатуры."""
    name = models.CharField("Название", max_length=255)
    parent = models.ForeignKey(
        "self", on_delete=models.CASCADE, null=True, blank=True, related_name="children"
    )

    class Meta:
        verbose_name = "Категория"
        verbose_name_plural = "Категории"

    def __str__(self):
        return self.name


class Product(AuditModel):
    """Карточка товара."""
    name = models.CharField("Название", max_length=255)
    sku = models.CharField("Артикул (SKU)", max_length=100, unique=True, db_index=True)
    barcode = models.CharField("Штрихкод", max_length=100, blank=True, db_index=True)
    category = models.ForeignKey(
        Category, on_delete=models.SET_NULL, null=True, blank=True, related_name="products"
    )
    unit = models.CharField("Единица измерения", max_length=20, default="шт")
    description = models.TextField("Описание", blank=True)
    amount = models.DecimalField("Сумма", max_digits=14, decimal_places=2, default=0)
    is_active = models.BooleanField("Активен", default=True)
    photo = models.ImageField("Фото", upload_to="products/%Y/%m/", null=True, blank=True)

    class Meta:
        verbose_name = "Товар"
        verbose_name_plural = "Товары"
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.sku})"
