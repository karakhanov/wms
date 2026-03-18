from rest_framework import serializers
from .models import Supplier, Receipt, ReceiptItem
from stock.models import StockBalance


class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = ("id", "name", "inn", "contact")


class ReceiptItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    product_sku = serializers.CharField(source="product.sku", read_only=True)
    cell_name = serializers.CharField(source="cell.name", read_only=True)

    class Meta:
        model = ReceiptItem
        fields = ("id", "product", "product_name", "product_sku", "cell", "cell_name", "quantity")


class ReceiptSerializer(serializers.ModelSerializer):
    items = ReceiptItemSerializer(many=True, read_only=True)
    created_by_username = serializers.CharField(source="created_by.username", read_only=True)
    supplier_name = serializers.CharField(source="supplier.name", read_only=True)

    class Meta:
        model = Receipt
        fields = ("id", "created_at", "created_by", "created_by_username", "supplier", "supplier_name", "comment", "items")


class ReceiptCreateSerializer(serializers.ModelSerializer):
    items = ReceiptItemSerializer(many=True)

    class Meta:
        model = Receipt
        fields = ("id", "supplier", "comment", "items")

    def create(self, validated_data):
        items_data = validated_data.pop("items")
        receipt = Receipt.objects.create(**validated_data)
        for item in items_data:
            ri = ReceiptItem.objects.create(receipt=receipt, **item)
            balance, _ = StockBalance.objects.get_or_create(product=ri.product, cell=ri.cell, defaults={"quantity": 0})
            balance.quantity += ri.quantity
            balance.save(update_fields=["quantity", "updated_at"])
        return receipt
