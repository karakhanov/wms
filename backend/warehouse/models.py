"""
Управление складом: структура Склад — Зона — Стеллаж — Ячейка.
"""
from django.db import models
from users.models import AuditModel


class Warehouse(AuditModel):
    """Склад."""
    name = models.CharField("Название", max_length=255)
    address = models.CharField("Адрес", max_length=500, blank=True)
    is_active = models.BooleanField("Активен", default=True)

    class Meta:
        verbose_name = "Склад"
        verbose_name_plural = "Склады"

    def __str__(self):
        return self.name


class Zone(AuditModel):
    """Зона хранения (в пределах склада)."""
    warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE, related_name="zones")
    name = models.CharField("Название", max_length=255)
    code = models.CharField("Код", max_length=50, blank=True)

    class Meta:
        verbose_name = "Зона"
        verbose_name_plural = "Зоны"
        unique_together = [("warehouse", "name")]

    def __str__(self):
        return f"{self.warehouse.name} / {self.name}"


class Rack(AuditModel):
    """Стеллаж (в зоне)."""
    zone = models.ForeignKey(Zone, on_delete=models.CASCADE, related_name="racks")
    name = models.CharField("Название", max_length=255)
    code = models.CharField("Код", max_length=50, blank=True)

    class Meta:
        verbose_name = "Стеллаж"
        verbose_name_plural = "Стеллажи"
        unique_together = [("zone", "name")]

    def __str__(self):
        return f"{self.zone} / {self.name}"


class Cell(AuditModel):
    """Ячейка хранения (в стеллаже)."""
    rack = models.ForeignKey(Rack, on_delete=models.CASCADE, related_name="cells")
    name = models.CharField("Название/адрес", max_length=100)
    code = models.CharField("Код", max_length=50, blank=True)
    is_active = models.BooleanField("Активна", default=True)

    class Meta:
        verbose_name = "Ячейка"
        verbose_name_plural = "Ячейки"
        unique_together = [("rack", "name")]

    def __str__(self):
        return f"{self.rack} / {self.name}"
