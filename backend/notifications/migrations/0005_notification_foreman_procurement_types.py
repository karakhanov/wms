# Generated manually for new issue-note → foreman notification types

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("notifications", "0004_alter_notification_type"),
    ]

    operations = [
        migrations.AlterField(
            model_name="notification",
            name="type",
            field=models.CharField(
                choices=[
                    ("issue_note_submitted", "Накладная отправлена"),
                    ("issue_note_approved", "Накладная одобрена"),
                    ("issue_note_rejected", "Накладная отклонена"),
                    ("issue_note_sent_procurement", "Накладная у снабжения"),
                    ("issue_note_foreman_procurement_shortage", "Прорабу: нехватка передана в снабжение"),
                    ("issue_note_foreman_procurement_goods_in", "Прорабу: закупленный товар принят на склад"),
                    ("issue_note_procurement_declined", "Снабжение отказало"),
                    ("issue_note_goods_for_inspection", "Товар для приёмки"),
                    ("issue_note_assign_controllers", "Назначьте контролёров на приёмку"),
                    ("issue_note_inspection_done", "Приёмка завершена"),
                    ("issue_note_ready_pickup", "Накладная готова к выдаче"),
                    ("issue_note_received_foreman", "Прораб подтвердил получение"),
                ],
                db_index=True,
                max_length=64,
            ),
        ),
    ]
