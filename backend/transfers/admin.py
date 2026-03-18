from django.contrib import admin
from .models import Transfer, TransferItem


class TransferItemInline(admin.TabularInline):
    model = TransferItem
    extra = 0


@admin.register(Transfer)
class TransferAdmin(admin.ModelAdmin):
    list_display = ("id", "created_at", "created_by")
    inlines = [TransferItemInline]
