from django.core.management.base import BaseCommand
from users.models import Role


class Command(BaseCommand):
    help = "Создать роли: Администратор, Менеджер, Кладовщик, Прораб"

    def handle(self, *args, **options):
        for value, label in Role.Name.choices:
            Role.objects.get_or_create(name=value, defaults={})
        self.stdout.write(self.style.SUCCESS("Роли созданы."))
