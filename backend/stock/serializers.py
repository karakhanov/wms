from rest_framework import serializers
from .models import StockBalance, MinStockLevel
from products.serializers import ProductSerializer
from warehouse.serializers import CellListSerializer


class StockBalanceSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    product_sku = serializers.CharField(source="product.sku", read_only=True)
    cell_name = serializers.CharField(source="cell.name", read_only=True)

    class Meta:
        model = StockBalance
        fields = ("id", "product", "product_name", "product_sku", "cell", "cell_name", "quantity", "updated_at")


class MinStockLevelSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    product_sku = serializers.CharField(source="product.sku", read_only=True)

    class Meta:
        model = MinStockLevel
        fields = ("id", "product", "product_name", "product_sku", "min_quantity", "notify")
