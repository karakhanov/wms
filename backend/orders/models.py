"""
Отгрузка товара: заказ, список для сборки, сканирование при сборке,
списание со склада, статусы (Создан, Собирается, Отправлен).
"""
from django.db import models
from users.models import AuditModel
from products.models import Product
from warehouse.models import Cell
from stock.models import StockBalance


class Order(AuditModel):
    """Заказ на отгрузку."""
    class Status(models.TextChoices):
        CREATED = "created", "Создан"
        PICKING = "picking", "Собирается"
        SHIPPED = "shipped", "Отправлен"

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.CREATED, db_index=True)
    client_name = models.CharField("Клиент", max_length=255, blank=True)
    comment = models.TextField(blank=True)

    class Meta:
        verbose_name = "Заказ"
        verbose_name_plural = "Заказы"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Заказ #{self.id} ({self.get_status_display()})"


class OrderItem(AuditModel):
    """Строка заказа: товар, количество. При сборке списывается с ячеек."""
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name="order_items")
    quantity = models.DecimalField("Количество", max_digits=14, decimal_places=3)
    cell = models.ForeignKey(
        Cell, on_delete=models.SET_NULL, null=True, blank=True, related_name="order_items"
    )

    class Meta:
        verbose_name = "Строка заказа"
        verbose_name_plural = "Строки заказа"
