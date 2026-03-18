from rest_framework import serializers
from .models import Category, Product


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ("id", "name", "parent")


class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)
    photo = serializers.ImageField(required=False, allow_null=True)

    class Meta:
        model = Product
        fields = (
            "id", "name", "sku", "barcode", "category", "category_name",
            "unit", "description", "amount", "is_active", "photo", "created_at", "updated_at"
        )
