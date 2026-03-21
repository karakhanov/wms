from django.contrib import admin

from .models import ConstructionObject


@admin.register(ConstructionObject)
class ConstructionObjectAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "code", "address", "is_active")
    list_filter = ("is_active",)
    search_fields = ("name", "code", "address")
