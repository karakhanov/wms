from django.db import migrations


def add_roles(apps, schema_editor):
    Role = apps.get_model("users", "Role")
    pairs = (
        ("procurement", "Снабженец"),
        ("warehouse_controller", "Контролёр склада"),
    )
    for name, _label in pairs:
        Role.objects.get_or_create(name=name)


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0007_actionlog_device_actionlog_ip_address_and_more"),
    ]

    operations = [
        migrations.RunPython(add_roles, noop_reverse),
    ]
