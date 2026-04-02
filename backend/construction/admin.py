from django.contrib import admin

from .models import ConstructionObject, ConstructionObjectType


@admin.register(ConstructionObjectType)
class ConstructionObjectTypeAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "code", "limit_amount", "limit_quantity", "is_active")
    list_filter = ("is_active",)
    search_fields = ("name", "code", "description")


@admin.register(ConstructionObject)
class ConstructionObjectAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "name",
        "code",
        "object_type",
        "limit_amount_override",
        "limit_quantity_override",
        "address",
        "is_active",
    )
    list_filter = ("is_active", "object_type")
    search_fields = ("name", "code", "address")
