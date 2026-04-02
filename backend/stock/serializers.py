from rest_framework import serializers
from .models import StockBalance, MinStockLevel
from products.serializers import resolve_product_photo_url


class StockBalanceSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    product_sku = serializers.CharField(source="product.sku", read_only=True)
    product_barcode = serializers.CharField(source="product.barcode", read_only=True, allow_blank=True)
    product_unit = serializers.CharField(source="product.unit", read_only=True)
    product_category_name = serializers.CharField(source="product.category.name", read_only=True, allow_null=True)
    product_photo = serializers.ImageField(source="product.photo", read_only=True, allow_null=True)
    product_photo_url = serializers.SerializerMethodField(read_only=True)
    cell_name = serializers.CharField(source="cell.name", read_only=True)
    warehouse_name = serializers.CharField(source="cell.rack.zone.warehouse.name", read_only=True)
    zone_name = serializers.CharField(source="cell.rack.zone.name", read_only=True)
    rack_name = serializers.CharField(source="cell.rack.name", read_only=True)

    def get_product_photo_url(self, obj):
        return resolve_product_photo_url(obj.product, self.context.get("request"))

    class Meta:
        model = StockBalance
        fields = (
            "id",
            "product",
            "product_name",
            "product_sku",
            "product_barcode",
            "product_unit",
            "product_category_name",
            "product_photo",
            "product_photo_url",
            "cell",
            "cell_name",
            "warehouse_name",
            "zone_name",
            "rack_name",
            "quantity",
            "updated_at",
        )


class MinStockLevelSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    product_sku = serializers.CharField(source="product.sku", read_only=True)

    class Meta:
        model = MinStockLevel
        fields = ("id", "product", "product_name", "product_sku", "min_quantity", "notify")
