from django.conf import settings
from django.db import models

from users.models import AuditModel


class Notification(AuditModel):
    class Type(models.TextChoices):
        ISSUE_NOTE_SUBMITTED = "issue_note_submitted", "Накладная отправлена"
        ISSUE_NOTE_APPROVED = "issue_note_approved", "Накладная одобрена"
        ISSUE_NOTE_REJECTED = "issue_note_rejected", "Накладная отклонена"
        ISSUE_NOTE_SENT_PROCUREMENT = "issue_note_sent_procurement", "Накладная у снабжения"
        ISSUE_NOTE_FOREMAN_PROCUREMENT_SHORTAGE = (
            "issue_note_foreman_procurement_shortage",
            "Прорабу: нехватка передана в снабжение",
        )
        ISSUE_NOTE_FOREMAN_PROCUREMENT_GOODS_IN = (
            "issue_note_foreman_procurement_goods_in",
            "Прорабу: закупленный товар принят на склад",
        )
        ISSUE_NOTE_FOREMAN_WAREHOUSE_RECEIVED = (
            "issue_note_foreman_warehouse_received",
            "Прорабу: товар оприходован, накладная закрыта",
        )
        ISSUE_NOTE_PROCUREMENT_DECLINED = "issue_note_procurement_declined", "Снабжение отказало"
        ISSUE_NOTE_GOODS_FOR_INSPECTION = "issue_note_goods_for_inspection", "Товар для приёмки"
        ISSUE_NOTE_ASSIGN_CONTROLLERS = "issue_note_assign_controllers", "Назначьте контролёров на приёмку"
        ISSUE_NOTE_INSPECTION_DONE = "issue_note_inspection_done", "Приёмка завершена"
        ISSUE_NOTE_READY_PICKUP = "issue_note_ready_pickup", "Накладная готова к выдаче"
        ISSUE_NOTE_STOREKEEPER_START_PICKING = (
            "issue_note_storekeeper_start_picking",
            "Кладовщику: начать сборку накладной",
        )
        ISSUE_NOTE_RECEIVED_FOREMAN = "issue_note_received_foreman", "Прораб подтвердил получение"

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications_received",
        verbose_name="Получатель",
    )
    type = models.CharField(max_length=64, choices=Type.choices, db_index=True)
    title = models.CharField(max_length=255)
    message = models.TextField(blank=True)
    payload = models.JSONField(default=dict, blank=True)
    entity_type = models.CharField(max_length=64, blank=True, default="")
    entity_id = models.PositiveBigIntegerField(null=True, blank=True, db_index=True)
    is_read = models.BooleanField(default=False, db_index=True)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Уведомление"
        verbose_name_plural = "Уведомления"
