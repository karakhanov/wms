from rest_framework import serializers
from .models import Inventory, InventoryItem, InventoryAdjustment
from stock.models import StockBalance


class InventoryItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    product_sku = serializers.CharField(source="product.sku", read_only=True)
    cell_name = serializers.CharField(source="cell.name", read_only=True)
    difference = serializers.SerializerMethodField()

    def get_difference(self, obj):
        return obj.actual_quantity - obj.system_quantity

    class Meta:
        model = InventoryItem
        fields = (
            "id", "product", "product_name", "product_sku", "cell", "cell_name",
            "system_quantity", "actual_quantity", "difference"
        )


class InventorySerializer(serializers.ModelSerializer):
    items = InventoryItemSerializer(many=True, read_only=True)
    created_by_username = serializers.CharField(source="created_by.username", read_only=True)
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)

    class Meta:
        model = Inventory
        fields = ("id", "created_at", "created_by", "created_by_username", "warehouse", "warehouse_name", "comment", "is_completed", "items")


class InventoryCreateSerializer(serializers.ModelSerializer):
    items = InventoryItemSerializer(many=True)

    class Meta:
        model = Inventory
        fields = ("id", "warehouse", "comment", "items")

    def create(self, validated_data):
        items_data = validated_data.pop("items")
        inv = Inventory.objects.create(**validated_data)
        for item in items_data:
            balance = StockBalance.objects.filter(product=item["product"], cell=item["cell"]).first()
            system_qty = balance.quantity if balance else 0
            InventoryItem.objects.create(
                inventory=inv,
                product=item["product"],
                cell=item["cell"],
                system_quantity=system_qty,
                actual_quantity=item.get("actual_quantity", 0),
            )
        return inv
