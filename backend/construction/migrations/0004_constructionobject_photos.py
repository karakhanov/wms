from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("construction", "0003_constructionobjecttypeitemlimit"),
    ]

    operations = [
        migrations.AddField(
            model_name="constructionobject",
            name="photo",
            field=models.ImageField(blank=True, null=True, upload_to="construction/objects/", verbose_name="Фото"),
        ),
        migrations.AddField(
            model_name="constructionobjecttype",
            name="photo",
            field=models.ImageField(blank=True, null=True, upload_to="construction/object-types/", verbose_name="Фото"),
        ),
    ]

