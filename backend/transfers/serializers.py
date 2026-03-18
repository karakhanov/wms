from rest_framework import serializers
from .models import Transfer, TransferItem
from stock.models import StockBalance


class TransferItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    product_sku = serializers.CharField(source="product.sku", read_only=True)
    cell_from_name = serializers.CharField(source="cell_from.name", read_only=True)
    cell_to_name = serializers.CharField(source="cell_to.name", read_only=True)

    class Meta:
        model = TransferItem
        fields = ("id", "product", "product_name", "product_sku", "cell_from", "cell_from_name", "cell_to", "cell_to_name", "quantity")


class TransferSerializer(serializers.ModelSerializer):
    items = TransferItemSerializer(many=True, read_only=True)
    created_by_username = serializers.CharField(source="created_by.username", read_only=True)

    class Meta:
        model = Transfer
        fields = ("id", "created_at", "created_by", "created_by_username", "comment", "items")


class TransferCreateSerializer(serializers.ModelSerializer):
    items = TransferItemSerializer(many=True)

    class Meta:
        model = Transfer
        fields = ("id", "comment", "items")

    def create(self, validated_data):
        items_data = validated_data.pop("items")
        transfer = Transfer.objects.create(**validated_data)
        for item in items_data:
            ti = TransferItem.objects.create(transfer=transfer, **item)
            # Списать с cell_from
            bal_from, _ = StockBalance.objects.get_or_create(product=ti.product, cell=ti.cell_from, defaults={"quantity": 0})
            bal_from.quantity -= ti.quantity
            bal_from.save(update_fields=["quantity", "updated_at"])
            # Добавить в cell_to
            bal_to, _ = StockBalance.objects.get_or_create(product=ti.product, cell=ti.cell_to, defaults={"quantity": 0})
            bal_to.quantity += ti.quantity
            bal_to.save(update_fields=["quantity", "updated_at"])
        return transfer
