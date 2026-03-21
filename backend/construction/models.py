from django.db import models

from users.models import AuditModel


class ConstructionObject(AuditModel):
    name = models.CharField("Объект", max_length=255, unique=True)
    code = models.CharField("Код", max_length=64, blank=True)
    address = models.CharField("Адрес", max_length=255, blank=True)
    is_active = models.BooleanField("Активен", default=True)

    class Meta:
        verbose_name = "Строительный объект"
        verbose_name_plural = "Строительные объекты"
        ordering = ["name"]

    def __str__(self):
        return self.name
