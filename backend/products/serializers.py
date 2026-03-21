from rest_framework import serializers
from .models import Category, Product, Unit


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ("id", "name", "parent")


class UnitSerializer(serializers.ModelSerializer):
    class Meta:
        model = Unit
        fields = ("id", "symbol", "name", "is_active")


class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)
    photo = serializers.ImageField(required=False, allow_null=True)

    def validate_unit(self, value):
        # unit хранится строкой в Product.unit, но допустимые значения берём из справочника.
        if not value:
            return value
        if not Unit.objects.filter(symbol=value, is_active=True).exists():
            raise serializers.ValidationError("Недопустимая единица измерения.")
        return value

    class Meta:
        model = Product
        fields = (
            "id", "name", "sku", "barcode", "category", "category_name",
            "unit", "description", "amount", "is_active", "photo", "created_at", "updated_at"
        )
