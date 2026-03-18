"""
Инвентаризация: запуск, пересчёт, сканирование, сравнение с системой,
корректировка остатков, акты расхождений.
"""
from django.conf import settings
from django.db import models
from users.models import AuditModel
from products.models import Product
from warehouse.models import Cell
from stock.models import StockBalance


class Inventory(AuditModel):
    """Документ инвентаризации."""
    warehouse = models.ForeignKey(
        "warehouse.Warehouse", on_delete=models.CASCADE, related_name="inventories"
    )
    comment = models.TextField(blank=True)
    is_completed = models.BooleanField("Завершена", default=False)

    class Meta:
        verbose_name = "Инвентаризация"
        verbose_name_plural = "Инвентаризации"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Инвентаризация #{self.id} ({self.warehouse.name})"


class InventoryItem(AuditModel):
    """Фактический пересчёт: товар, ячейка, количество в системе, фактическое."""
    inventory = models.ForeignKey(Inventory, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name="inventory_items")
    cell = models.ForeignKey(Cell, on_delete=models.PROTECT, related_name="inventory_items")
    system_quantity = models.DecimalField("В системе", max_digits=14, decimal_places=3, default=0)
    actual_quantity = models.DecimalField("Фактически", max_digits=14, decimal_places=3, default=0)

    class Meta:
        verbose_name = "Строка инвентаризации"
        verbose_name_plural = "Строки инвентаризации"

    @property
    def difference(self):
        return self.actual_quantity - self.system_quantity


class InventoryAdjustment(AuditModel):
    """Акт расхождений / применение корректировки остатков."""
    inventory = models.OneToOneField(Inventory, on_delete=models.CASCADE, related_name="adjustment")
    applied_at = models.DateTimeField(auto_now_add=True)
    applied_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="inventory_adjustments"
    )

    class Meta:
        verbose_name = "Корректировка по инвентаризации"
        verbose_name_plural = "Корректировки"
