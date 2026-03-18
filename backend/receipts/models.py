"""
Приём товара (приход): документ приёмки, поставщик, сканирование штрихкодов,
автооприходование, размещение по ячейкам.
"""
from django.db import models
from users.models import AuditModel
from products.models import Product
from warehouse.models import Cell


class Supplier(AuditModel):
    """Поставщик."""
    name = models.CharField("Название", max_length=255)
    inn = models.CharField("ИНН", max_length=20, blank=True)
    contact = models.CharField("Контакт", max_length=255, blank=True)

    class Meta:
        verbose_name = "Поставщик"
        verbose_name_plural = "Поставщики"

    def __str__(self):
        return self.name


class Receipt(AuditModel):
    """Документ приёмки: дата, сотрудник, поставщик, список товаров."""
    supplier = models.ForeignKey(Supplier, on_delete=models.PROTECT, related_name="receipts")
    comment = models.TextField(blank=True)

    class Meta:
        verbose_name = "Приёмка"
        verbose_name_plural = "Приёмки"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Приёмка #{self.id} от {self.created_at.date()}"


class ReceiptItem(AuditModel):
    """Строка приёмки: товар, ячейка размещения, количество."""
    receipt = models.ForeignKey(Receipt, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name="receipt_items")
    cell = models.ForeignKey(Cell, on_delete=models.PROTECT, related_name="receipt_items")
    quantity = models.DecimalField("Количество", max_digits=14, decimal_places=3)

    class Meta:
        verbose_name = "Строка приёмки"
        verbose_name_plural = "Строки приёмки"
