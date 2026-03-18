"""
Управление остатками: текущие остатки по ячейкам, минимальный остаток, нехватка.
"""
from django.db import models
from users.models import AuditModel
from products.models import Product
from warehouse.models import Cell


class StockBalance(AuditModel):
    """Остаток товара в ячейке."""
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="stock_balances")
    cell = models.ForeignKey(Cell, on_delete=models.CASCADE, related_name="stock_balances")
    quantity = models.DecimalField("Количество", max_digits=14, decimal_places=3, default=0)

    class Meta:
        verbose_name = "Остаток"
        verbose_name_plural = "Остатки"
        unique_together = [("product", "cell")]
        ordering = ["product", "cell"]

    def __str__(self):
        return f"{self.product.sku} в {self.cell}: {self.quantity}"


class MinStockLevel(AuditModel):
    """Минимальный остаток по товару (для уведомлений о нехватке)."""
    product = models.OneToOneField(
        Product, on_delete=models.CASCADE, related_name="min_stock_level"
    )
    min_quantity = models.DecimalField("Минимальное количество", max_digits=14, decimal_places=3)
    notify = models.BooleanField("Уведомлять о нехватке", default=True)

    class Meta:
        verbose_name = "Минимальный остаток"
        verbose_name_plural = "Минимальные остатки"
