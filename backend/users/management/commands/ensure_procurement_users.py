"""
Создаёт в БД роли (все из Role.Name) и тестовых пользователей снабжения и контролёра, если их ещё нет.
Пароли только для локальной разработки — смените в продакшене.

Запуск: python manage.py ensure_procurement_users
"""
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from users.models import Role

User = get_user_model()


class Command(BaseCommand):
    help = "Создать роли и пользователей procurement / warehouse_controller (если отсутствуют)"

    def handle(self, *args, **options):
        for value, _ in Role.Name.choices:
            Role.objects.get_or_create(name=value)

        role_proc, _ = Role.objects.get_or_create(name=Role.Name.PROCUREMENT)
        role_ctrl, _ = Role.objects.get_or_create(name=Role.Name.WAREHOUSE_CONTROLLER)

        users_spec = [
            ("procurement", "procurement123", "Снабженец (тест)", role_proc),
            ("controller", "controller123", "Контролёр склада (тест)", role_ctrl),
        ]
        for username, password, full_name, role in users_spec:
            user, created = User.objects.get_or_create(
                username=username,
                defaults={
                    "email": f"{username}@wms.local",
                    "full_name": full_name,
                    "role": role,
                    "is_active": True,
                },
            )
            if created:
                user.set_password(password)
                user.save()
                self.stdout.write(self.style.SUCCESS(f"  Создан пользователь {username} / {password}"))
            else:
                if user.role_id != role.id:
                    user.role = role
                    user.save(update_fields=["role", "updated_at"])
                    self.stdout.write(self.style.WARNING(f"  {username}: обновлена роль → {role.name}"))
                else:
                    self.stdout.write(f"  {username}: уже существует, пропуск")

        self.stdout.write(
            self.style.SUCCESS(
                "Готово. Вход: procurement / procurement123, controller / controller123"
            )
        )
