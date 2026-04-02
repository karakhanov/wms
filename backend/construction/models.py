from django.db import models

from users.models import AuditModel


class ConstructionObjectType(AuditModel):
    name = models.CharField("Тип объекта", max_length=255, unique=True)
    code = models.CharField("Код типа", max_length=64, blank=True)
    description = models.TextField("Описание", blank=True)
    limit_amount = models.DecimalField("Лимит суммы", max_digits=14, decimal_places=2, null=True, blank=True)
    limit_quantity = models.DecimalField("Лимит количества", max_digits=14, decimal_places=3, null=True, blank=True)
    allowed_products = models.ManyToManyField(
        "products.Product",
        blank=True,
        related_name="allowed_in_object_types",
        verbose_name="Разрешенные товары",
    )
    allowed_services = models.ManyToManyField(
        "products.Service",
        blank=True,
        related_name="allowed_in_object_types",
        verbose_name="Разрешенные услуги",
    )
    is_active = models.BooleanField("Активен", default=True)
    photo = models.ImageField("Фото", upload_to="construction/object-types/", blank=True, null=True)

    class Meta:
        verbose_name = "Тип строительного объекта"
        verbose_name_plural = "Типы строительных объектов"
        ordering = ["name"]

    def __str__(self):
        return self.name


class ConstructionObjectTypeItemLimit(AuditModel):
    object_type = models.ForeignKey(
        ConstructionObjectType,
        on_delete=models.CASCADE,
        related_name="item_limits",
        verbose_name="Тип объекта",
    )
    product = models.ForeignKey(
        "products.Product",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="object_type_limits",
        verbose_name="Товар",
    )
    service = models.ForeignKey(
        "products.Service",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="object_type_limits",
        verbose_name="Услуга",
    )
    limit_quantity = models.DecimalField("Лимит количества", max_digits=14, decimal_places=3)

    class Meta:
        verbose_name = "Лимит типа объекта по позиции"
        verbose_name_plural = "Лимиты типов объектов по позициям"
        constraints = [
            models.CheckConstraint(
                check=(
                    (models.Q(product__isnull=False) & models.Q(service__isnull=True))
                    | (models.Q(product__isnull=True) & models.Q(service__isnull=False))
                ),
                name="construction_type_limit_exactly_one_item",
            ),
            models.UniqueConstraint(
                fields=["object_type", "product"],
                condition=models.Q(product__isnull=False),
                name="construction_type_limit_unique_product",
            ),
            models.UniqueConstraint(
                fields=["object_type", "service"],
                condition=models.Q(service__isnull=False),
                name="construction_type_limit_unique_service",
            ),
        ]

    def __str__(self):
        if self.product_id:
            return f"{self.object_type}: {self.product} <= {self.limit_quantity}"
        return f"{self.object_type}: {self.service} <= {self.limit_quantity}"


class ConstructionObject(AuditModel):
    name = models.CharField("Объект", max_length=255, unique=True)
    code = models.CharField("Код", max_length=64, blank=True)
    address = models.CharField("Адрес", max_length=255, blank=True)
    object_type = models.ForeignKey(
        ConstructionObjectType,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="construction_objects",
        verbose_name="Тип объекта",
    )
    limit_amount_override = models.DecimalField(
        "Лимит суммы (override)",
        max_digits=14,
        decimal_places=2,
        null=True,
        blank=True,
    )
    limit_quantity_override = models.DecimalField(
        "Лимит количества (override)",
        max_digits=14,
        decimal_places=3,
        null=True,
        blank=True,
    )
    is_active = models.BooleanField("Активен", default=True)
    photo = models.ImageField("Фото", upload_to="construction/objects/", blank=True, null=True)

    class Meta:
        verbose_name = "Строительный объект"
        verbose_name_plural = "Строительные объекты"
        ordering = ["name"]

    def __str__(self):
        return self.name
