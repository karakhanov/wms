from django.contrib import admin
from .models import Supplier, Receipt, ReceiptItem


class ReceiptItemInline(admin.TabularInline):
    model = ReceiptItem
    extra = 0


@admin.register(Supplier)
class SupplierAdmin(admin.ModelAdmin):
    list_display = ("name", "inn", "contact")


@admin.register(Receipt)
class ReceiptAdmin(admin.ModelAdmin):
    list_display = ("id", "created_at", "created_by", "supplier")
    list_filter = ("supplier", "created_at")
    inlines = [ReceiptItemInline]

