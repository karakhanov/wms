from django.templatetags.static import static
from rest_framework import serializers

from .models import Category, Product, Unit, Service


def resolve_product_photo_url(product, request):
    """URL медиа-фото или статической заглушки."""
    if product and product.photo and getattr(product.photo, "name", None):
        url = product.photo.url
        if request:
            return request.build_absolute_uri(url)
        return url
    rel = static("products/no-photo.svg")
    if request:
        return request.build_absolute_uri(rel)
    return rel


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
    photo_url = serializers.SerializerMethodField(read_only=True)

    def get_photo_url(self, obj):
        """Реальное фото или статическая заглушка (не путать с полем photo для загрузки)."""
        return resolve_product_photo_url(obj, self.context.get("request"))

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
            "unit", "description", "amount", "is_active", "photo", "photo_url",
            "created_at", "updated_at",
        )


class ServiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Service
        fields = (
            "id",
            "name",
            "code",
            "unit",
            "description",
            "amount",
            "is_active",
            "created_at",
            "updated_at",
        )
