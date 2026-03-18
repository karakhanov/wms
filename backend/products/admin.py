from django.contrib import admin
from .models import Category, Product


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "parent")


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("name", "sku", "barcode", "category", "unit", "amount", "is_active")
    list_filter = ("category", "is_active")
    search_fields = ("name", "sku", "barcode")
