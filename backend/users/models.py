"""
Управление пользователями: учётные записи, роли, журнал действий.
Роли: Администратор, Менеджер, Кладовщик.
"""
from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils.translation import gettext_lazy as _

from .audit import get_current_user


class AuditModel(models.Model):
    """Абстрактная модель: created_at, updated_at, created_by, updated_by, state."""
    created_at = models.DateTimeField(_("Создано"), auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(_("Изменено"), auto_now=True, null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="%(app_label)s_%(class)s_created",
        verbose_name=_("Кто создал"),
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="%(app_label)s_%(class)s_updated",
        verbose_name=_("Кто изменил"),
    )
    state = models.PositiveSmallIntegerField(_("Состояние"), default=1, db_index=True)

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        user = get_current_user()
        if user and user.is_authenticated:
            if not self.pk and not self.created_by_id:
                self.created_by = user
            self.updated_by = user
        super().save(*args, **kwargs)


class Role(AuditModel):
    """Роль пользователя: Администратор, Менеджер, Кладовщик."""
    class Name(models.TextChoices):
        ADMIN = "admin", "Администратор"
        MANAGER = "manager", "Менеджер"
        STOREKEEPER = "storekeeper", "Кладовщик"

    name = models.CharField(max_length=20, choices=Name.choices, unique=True)

    def __str__(self):
        return self.get_name_display()


class User(AbstractUser):
    """Учётная запись пользователя с привязкой к роли.
    created_by и updated_by заполняются автоматически при сохранении (админ/API).
    """
    role = models.ForeignKey(
        Role, on_delete=models.PROTECT, null=True, blank=True, related_name="users"
    )
    full_name = models.CharField("ФИО", max_length=255, blank=True)
    created_at = models.DateTimeField("Создано", auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField("Изменено", auto_now=True, null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="users_created",
        verbose_name="Кто создал",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="users_updated",
        verbose_name="Кто изменил",
    )
    state = models.PositiveSmallIntegerField("Состояние", default=1, db_index=True)

    class Meta:
        verbose_name = "Пользователь"
        verbose_name_plural = "Пользователи"

    def save(self, *args, **kwargs):
        user = get_current_user()
        if user and user.is_authenticated:
            if not self.pk and not self.created_by_id:
                self.created_by = user
            self.updated_by = user
        super().save(*args, **kwargs)


class ActionLog(AuditModel):
    """Журнал действий пользователей (кто, когда, действие)."""
    action = models.CharField(max_length=100)
    model_name = models.CharField(max_length=100, blank=True)
    object_id = models.CharField(max_length=50, blank=True)
    details = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Запись журнала"
        verbose_name_plural = "Журнал действий"
