from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("orders", "0009_issuenoteitem_comment"),
    ]

    operations = [
        migrations.AddField(
            model_name="issuenote",
            name="rejection_comment",
            field=models.TextField(blank=True, verbose_name="Причина отказа"),
        ),
    ]

