from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, Role, ActionLog


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ("name",)


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ("username", "email", "full_name", "role", "state", "is_staff")
    list_filter = ("role", "state", "is_staff")
    fieldsets = BaseUserAdmin.fieldsets + (
        ("Профиль", {"fields": ("role", "full_name", "created_at", "updated_at", "created_by", "updated_by", "state")}),
    )


@admin.register(ActionLog)
class ActionLogAdmin(admin.ModelAdmin):
    list_display = ("created_by", "action", "model_name", "state", "created_at")
    list_filter = ("action", "state", "created_at")
    search_fields = ("created_by__username", "action")
