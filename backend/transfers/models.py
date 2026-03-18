"""
Перемещение товара: между ячейками, сканирование, выбор склада/ячейки,
автообновление остатков.
"""
from django.db import models
from users.models import AuditModel
from products.models import Product
from warehouse.models import Cell
from stock.models import StockBalance


class Transfer(AuditModel):
    """Документ перемещения."""
    comment = models.TextField(blank=True)

    class Meta:
        verbose_name = "Перемещение"
        verbose_name_plural = "Перемещения"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Перемещение #{self.id}"


class TransferItem(AuditModel):
    """Строка: товар, из ячейки, в ячейку, количество."""
    transfer = models.ForeignKey(Transfer, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name="transfer_items")
    cell_from = models.ForeignKey(Cell, on_delete=models.PROTECT, related_name="transfer_out")
    cell_to = models.ForeignKey(Cell, on_delete=models.PROTECT, related_name="transfer_in")
    quantity = models.DecimalField("Количество", max_digits=14, decimal_places=3)

    class Meta:
        verbose_name = "Строка перемещения"
        verbose_name_plural = "Строки перемещения"
