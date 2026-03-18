from django.contrib import admin
from .models import Inventory, InventoryItem, InventoryAdjustment


class InventoryItemInline(admin.TabularInline):
    model = InventoryItem
    extra = 0


@admin.register(Inventory)
class InventoryAdmin(admin.ModelAdmin):
    list_display = ("id", "created_at", "created_by", "warehouse", "is_completed")
    list_filter = ("warehouse", "is_completed")
    inlines = [InventoryItemInline]


@admin.register(InventoryAdjustment)
class InventoryAdjustmentAdmin(admin.ModelAdmin):
    list_display = ("inventory", "applied_at", "applied_by")
