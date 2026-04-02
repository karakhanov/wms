from django.core.exceptions import DisallowedHost
from rest_framework import serializers

from .models import ConstructionObject, ConstructionObjectType, ConstructionObjectTypeItemLimit


class ConstructionObjectTypeItemLimitSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    product_sku = serializers.CharField(source="product.sku", read_only=True)
    service_name = serializers.CharField(source="service.name", read_only=True)
    service_code = serializers.CharField(source="service.code", read_only=True)

    class Meta:
        model = ConstructionObjectTypeItemLimit
        fields = (
            "id",
            "product",
            "product_name",
            "product_sku",
            "service",
            "service_name",
            "service_code",
            "limit_quantity",
        )

    def validate(self, attrs):
        product = attrs.get("product")
        service = attrs.get("service")
        if bool(product) == bool(service):
            raise serializers.ValidationError("Укажите либо товар, либо услугу.")
        return attrs


class ConstructionObjectTypeSerializer(serializers.ModelSerializer):
    item_limits = ConstructionObjectTypeItemLimitSerializer(many=True, required=False)
    photo_url = serializers.SerializerMethodField()

    class Meta:
        model = ConstructionObjectType
        fields = (
            "id",
            "name",
            "code",
            "description",
            "limit_amount",
            "limit_quantity",
            "allowed_products",
            "allowed_services",
            "item_limits",
            "is_active",
            "photo",
            "photo_url",
        )
        extra_kwargs = {
            # Avoid DRF building absolute host-based URL for ImageField.
            "photo": {"use_url": False},
        }

    def get_photo_url(self, obj):
        if not obj.photo:
            return ""
        request = self.context.get("request")
        if request:
            try:
                return request.build_absolute_uri(obj.photo.url)
            except DisallowedHost:
                return obj.photo.url
        return obj.photo.url

    def create(self, validated_data):
        item_limits = validated_data.pop("item_limits", [])
        obj_type = super().create(validated_data)
        for row in item_limits:
            ConstructionObjectTypeItemLimit.objects.create(object_type=obj_type, **row)
        return obj_type

    def update(self, instance, validated_data):
        item_limits = validated_data.pop("item_limits", None)
        obj_type = super().update(instance, validated_data)
        if item_limits is not None:
            obj_type.item_limits.all().delete()
            for row in item_limits:
                ConstructionObjectTypeItemLimit.objects.create(object_type=obj_type, **row)
        return obj_type


class ConstructionObjectSerializer(serializers.ModelSerializer):
    object_type_name = serializers.CharField(source="object_type.name", read_only=True)
    photo_url = serializers.SerializerMethodField()

    class Meta:
        model = ConstructionObject
        fields = (
            "id",
            "name",
            "code",
            "address",
            "object_type",
            "object_type_name",
            "limit_amount_override",
            "limit_quantity_override",
            "is_active",
            "photo",
            "photo_url",
        )
        extra_kwargs = {
            # Avoid DRF building absolute host-based URL for ImageField.
            "photo": {"use_url": False},
        }

    def get_photo_url(self, obj):
        if not obj.photo:
            return ""
        request = self.context.get("request")
        if request:
            try:
                return request.build_absolute_uri(obj.photo.url)
            except DisallowedHost:
                return obj.photo.url
        return obj.photo.url
