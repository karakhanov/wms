from django.db import migrations


def backfill_construction_object(apps, schema_editor):
    MaterialRequest = apps.get_model("orders", "MaterialRequest")
    ConstructionObject = apps.get_model("construction", "ConstructionObject")

    for req in MaterialRequest.objects.filter(construction_object__isnull=True).exclude(object_name=""):
        obj, _ = ConstructionObject.objects.get_or_create(name=req.object_name, defaults={"is_active": True})
        req.construction_object_id = obj.id
        req.save(update_fields=["construction_object"])


class Migration(migrations.Migration):
    dependencies = [
        ("construction", "0001_initial"),
        ("orders", "0005_materialrequest_construction_object"),
    ]

    operations = [
        migrations.RunPython(backfill_construction_object, migrations.RunPython.noop),
    ]
