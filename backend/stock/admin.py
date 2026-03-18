from django.contrib import admin
from .models import StockBalance, MinStockLevel


@admin.register(StockBalance)
class StockBalanceAdmin(admin.ModelAdmin):
    list_display = ("product", "cell", "quantity", "updated_at")
    list_filter = ("product", "cell__rack__zone__warehouse")


@admin.register(MinStockLevel)
class MinStockLevelAdmin(admin.ModelAdmin):
    list_display = ("product", "min_quantity", "notify")
