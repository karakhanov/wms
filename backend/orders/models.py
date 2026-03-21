"""
Отгрузка товара: заказ, список для сборки, сканирование при сборке,
списание со склада, статусы (Создан, Собирается, Отправлен).
"""
from django.db import models
from users.models import AuditModel
from products.models import Product
from warehouse.models import Cell
from stock.models import StockBalance
from construction.models import ConstructionObject


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


class MaterialRequest(AuditModel):
    """Заявка прораба на материалы для объекта/задачи."""

    class Status(models.TextChoices):
        DRAFT = "draft", "Черновик"
        SUBMITTED = "submitted", "На согласовании"
        APPROVED = "approved", "Одобрена"
        REJECTED = "rejected", "Отклонена"
        ISSUED = "issued", "Выдана"

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT, db_index=True)
    construction_object = models.ForeignKey(
        ConstructionObject,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="material_requests",
        verbose_name="Строительный объект",
    )
    object_name = models.CharField("Объект", max_length=255, blank=True, default="")
    work_type = models.CharField("Вид работ", max_length=255, blank=True)
    needed_at = models.DateField("Нужно к дате", null=True, blank=True)
    comment = models.TextField(blank=True)
    approved_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="approved_material_requests",
        verbose_name="Кто одобрил",
    )
    approved_at = models.DateTimeField("Дата одобрения", null=True, blank=True)

    class Meta:
        verbose_name = "Заявка на материалы"
        verbose_name_plural = "Заявки на материалы"
        ordering = ["-created_at"]


class MaterialRequestItem(AuditModel):
    request = models.ForeignKey(MaterialRequest, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name="material_request_items")
    quantity = models.DecimalField("Количество", max_digits=14, decimal_places=3)
    issued_quantity = models.DecimalField("Выдано", max_digits=14, decimal_places=3, default=0)

    class Meta:
        verbose_name = "Строка заявки"
        verbose_name_plural = "Строки заявки"


class IssueNote(AuditModel):
    """Накладная выдачи (создает прораб, согласует менеджер)."""

    class Status(models.TextChoices):
        SUBMITTED = "submitted", "На согласовании"
        APPROVED = "approved", "Одобрена"
        REJECTED = "rejected", "Отклонена"

    number = models.CharField("Номер накладной", max_length=50, unique=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.SUBMITTED, db_index=True)
    request = models.ForeignKey(
        MaterialRequest, on_delete=models.PROTECT, related_name="issue_notes", null=True, blank=True
    )
    construction_object = models.ForeignKey(
        ConstructionObject,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="issue_notes",
        verbose_name="Строительный объект",
    )
    recipient_name = models.CharField("Получатель", max_length=255)
    comment = models.TextField(blank=True)
    rejection_comment = models.TextField("Причина отказа", blank=True)
    approved_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="approved_issue_notes",
        verbose_name="Кто одобрил",
    )
    approved_at = models.DateTimeField("Дата одобрения", null=True, blank=True)

    class Meta:
        verbose_name = "Накладная выдачи"
        verbose_name_plural = "Накладные выдачи"
        ordering = ["-created_at"]


class IssueNoteItem(AuditModel):
    issue_note = models.ForeignKey(IssueNote, on_delete=models.CASCADE, related_name="items")
    request_item = models.ForeignKey(
        MaterialRequestItem,
        on_delete=models.PROTECT,
        related_name="issue_note_items",
        null=True,
        blank=True,
    )
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name="issue_note_items")
    quantity = models.DecimalField("Количество", max_digits=14, decimal_places=3)
    comment = models.TextField("Комментарий", blank=True)
    cell = models.ForeignKey(
        Cell, on_delete=models.SET_NULL, null=True, blank=True, related_name="issue_note_items"
    )

    class Meta:
        verbose_name = "Строка накладной"
        verbose_name_plural = "Строки накладной"
