from rest_framework import serializers
from .models import (
    Order,
    OrderItem,
    MaterialRequest,
    MaterialRequestItem,
    IssueNote,
    IssueNoteItem,
)


class OrderItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    product_sku = serializers.CharField(source="product.sku", read_only=True)

    class Meta:
        model = OrderItem
        fields = ("id", "product", "product_name", "product_sku", "quantity", "cell")


class OrderListSerializer(serializers.ModelSerializer):
    """Список заказов без строк — для дашборда и таблиц."""
    created_by_username = serializers.CharField(source="created_by.username", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = Order
        fields = (
            "id",
            "created_at",
            "created_by_username",
            "status",
            "status_display",
            "client_name",
            "comment",
        )


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    created_by_username = serializers.CharField(source="created_by.username", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = Order
        fields = ("id", "created_at", "created_by", "created_by_username", "status", "status_display", "client_name", "comment", "items")


class OrderCreateSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True)

    class Meta:
        model = Order
        fields = ("id", "client_name", "comment", "items")

    def create(self, validated_data):
        items_data = validated_data.pop("items")
        order = Order.objects.create(**validated_data)
        for item in items_data:
            OrderItem.objects.create(order=order, **item)
        return order


class MaterialRequestItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    product_sku = serializers.CharField(source="product.sku", read_only=True)

    class Meta:
        model = MaterialRequestItem
        fields = ("id", "product", "product_name", "product_sku", "quantity", "issued_quantity")
        read_only_fields = ("issued_quantity",)


class MaterialRequestListSerializer(serializers.ModelSerializer):
    created_by_username = serializers.CharField(source="created_by.username", read_only=True)
    approved_by_username = serializers.CharField(source="approved_by.username", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    construction_object_name = serializers.CharField(source="construction_object.name", read_only=True)

    class Meta:
        model = MaterialRequest
        fields = (
            "id",
            "created_at",
            "created_by_username",
            "status",
            "status_display",
            "construction_object",
            "construction_object_name",
            "object_name",
            "work_type",
            "needed_at",
            "approved_by_username",
        )


class MaterialRequestSerializer(serializers.ModelSerializer):
    items = MaterialRequestItemSerializer(many=True, read_only=True)
    created_by_username = serializers.CharField(source="created_by.username", read_only=True)
    approved_by_username = serializers.CharField(source="approved_by.username", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    construction_object_name = serializers.CharField(source="construction_object.name", read_only=True)

    class Meta:
        model = MaterialRequest
        fields = (
            "id",
            "created_at",
            "created_by",
            "created_by_username",
            "status",
            "status_display",
            "construction_object",
            "construction_object_name",
            "object_name",
            "work_type",
            "needed_at",
            "comment",
            "approved_by",
            "approved_by_username",
            "approved_at",
            "items",
        )
        read_only_fields = ("approved_by", "approved_at")


class MaterialRequestCreateSerializer(serializers.ModelSerializer):
    items = MaterialRequestItemSerializer(many=True)

    class Meta:
        model = MaterialRequest
        fields = ("id", "construction_object", "object_name", "work_type", "needed_at", "comment", "status", "items")
        extra_kwargs = {"object_name": {"required": False, "allow_blank": True}}

    def validate(self, attrs):
        if not attrs.get("construction_object") and not attrs.get("object_name"):
            raise serializers.ValidationError("Укажите строительный объект или название объекта.")
        return attrs

    def create(self, validated_data):
        items_data = validated_data.pop("items")
        construction_object = validated_data.get("construction_object")
        if construction_object and not validated_data.get("object_name"):
            validated_data["object_name"] = construction_object.name
        req = MaterialRequest.objects.create(**validated_data)
        for item in items_data:
            MaterialRequestItem.objects.create(request=req, **item)
        return req


class IssueNoteItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    product_sku = serializers.CharField(source="product.sku", read_only=True)

    class Meta:
        model = IssueNoteItem
        fields = (
            "id",
            "request_item",
            "product",
            "product_name",
            "product_sku",
            "quantity",
            "actual_quantity",
            "inspection_photos",
            "inspection_comment",
            "comment",
            "cell",
        )
        read_only_fields = ("actual_quantity", "inspection_photos", "inspection_comment")
        extra_kwargs = {"request_item": {"required": False, "allow_null": True}}


class IssueNoteSerializer(serializers.ModelSerializer):
    items = IssueNoteItemSerializer(many=True, read_only=True)
    request_status = serializers.CharField(source="request.status", read_only=True)
    created_by_username = serializers.CharField(source="created_by.username", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    construction_object_name = serializers.CharField(source="construction_object.name", read_only=True)
    approved_by_username = serializers.CharField(source="approved_by.username", read_only=True)
    procurement_scan_url = serializers.SerializerMethodField()
    procurement_supplier_name = serializers.CharField(source="procurement_supplier.name", read_only=True, allow_null=True)
    procurement_supplier_inn = serializers.CharField(source="procurement_supplier.inn", read_only=True, allow_null=True)
    procurement_supplier_contact = serializers.CharField(source="procurement_supplier.contact", read_only=True, allow_null=True)
    inspection_invited_user_ids = serializers.SerializerMethodField()

    def get_procurement_scan_url(self, obj):
        f = obj.procurement_scan
        if not f:
            return None
        req = self.context.get("request")
        url = f.url
        if req:
            return req.build_absolute_uri(url)
        return url

    def get_inspection_invited_user_ids(self, obj):
        return list(obj.inspection_invited_users.values_list("id", flat=True))

    class Meta:
        model = IssueNote
        fields = (
            "id",
            "number",
            "created_at",
            "created_by",
            "created_by_username",
            "status",
            "status_display",
            "request",
            "request_status",
            "construction_object",
            "construction_object_name",
            "recipient_name",
            "comment",
            "procurement_notes",
            "procurement_purchase_date",
            "procurement_amount",
            "procurement_quantity_note",
            "procurement_counterparty",
            "procurement_supplier",
            "procurement_supplier_name",
            "procurement_supplier_inn",
            "procurement_supplier_contact",
            "procurement_item_ids",
            "procurement_vehicle",
            "procurement_delivery_notes",
            "procurement_scan_url",
            "rejection_comment",
            "approved_by",
            "approved_by_username",
            "approved_at",
            "inspection_invited_user_ids",
            "items",
        )


class IssueNoteCreateSerializer(serializers.ModelSerializer):
    items = IssueNoteItemSerializer(many=True)

    class Meta:
        model = IssueNote
        fields = ("id", "number", "request", "construction_object", "recipient_name", "comment", "rejection_comment", "items")
        extra_kwargs = {"number": {"required": False}}

    def validate(self, attrs):
        request_obj = attrs.get("request")
        construction_object = attrs.get("construction_object")
        if not request_obj and not construction_object:
            raise serializers.ValidationError("Укажите объект или заявку.")
        if request_obj and request_obj.status != MaterialRequest.Status.APPROVED:
            raise serializers.ValidationError("Если выбрана заявка, она должна быть одобрена.")
        return attrs

    def create(self, validated_data):
        validated_data.pop("items", None)
        return IssueNote.objects.create(**validated_data)


class IssueNoteUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = IssueNote
        fields = ("status", "rejection_comment", "procurement_notes")


class ControllerLineSerializer(serializers.Serializer):
    item_id = serializers.IntegerField(min_value=1)
    actual_quantity = serializers.DecimalField(max_digits=14, decimal_places=3, min_value=0)
    inspection_comment = serializers.CharField(required=False, allow_blank=True, default="")
    inspection_photos = serializers.ListField(
        child=serializers.CharField(max_length=500, allow_blank=True), allow_empty=True, required=False
    )

    def validate_inspection_photos(self, value):
        return [v.strip() for v in value if v and str(v).strip()]


class ControllerCompleteSerializer(serializers.Serializer):
    lines = ControllerLineSerializer(many=True)


class AssignInspectionSerializer(serializers.Serializer):
    user_ids = serializers.ListField(child=serializers.IntegerField(min_value=1), min_length=1)
