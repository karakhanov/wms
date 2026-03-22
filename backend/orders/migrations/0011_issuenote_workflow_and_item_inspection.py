from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("orders", "0010_issuenote_rejection_comment"),
    ]

    operations = [
        migrations.AddField(
            model_name="issuenote",
            name="procurement_notes",
            field=models.TextField(blank=True, verbose_name="Комментарий по снабжению"),
        ),
        migrations.AddField(
            model_name="issuenoteitem",
            name="actual_quantity",
            field=models.DecimalField(
                blank=True,
                decimal_places=3,
                max_digits=14,
                null=True,
                verbose_name="Фактически принято",
            ),
        ),
        migrations.AddField(
            model_name="issuenoteitem",
            name="inspection_photos",
            field=models.JSONField(blank=True, default=list, verbose_name="Фото приёмки (URL)"),
        ),
        migrations.AlterField(
            model_name="issuenote",
            name="status",
            field=models.CharField(
                choices=[
                    ("submitted", "На согласовании"),
                    ("awaiting_procurement", "У снабжения"),
                    ("procurement_active", "Закупка"),
                    ("awaiting_controller", "Ожидает приёмку"),
                    ("awaiting_release", "Ожидает выдачу со склада"),
                    ("approved", "Одобрена"),
                    ("picking", "Собирается"),
                    ("ready_pickup", "Готов к выдаче"),
                    ("received_foreman", "Прораб получил"),
                    ("rejected", "Отклонена"),
                ],
                db_index=True,
                default="submitted",
                max_length=24,
            ),
        ),
    ]
