from decimal import Decimal

from django.test import TestCase

from construction.models import ConstructionObject, ConstructionObjectType
from construction.services.limits import validate_items_for_object_limits
from orders.serializers import MaterialRequestCreateSerializer
from products.models import Product, Service


class ObjectLimitsTests(TestCase):
    def setUp(self):
        self.object_type = ConstructionObjectType.objects.create(
            name="Тестовый тип",
            limit_amount=Decimal("1000"),
            limit_quantity=Decimal("10"),
        )
        self.obj = ConstructionObject.objects.create(name="Объект 1", object_type=self.object_type)
        self.product = Product.objects.create(name="Песок", sku="SKU-SAND", unit="шт", amount=Decimal("100"))
        self.service = Service.objects.create(name="Доставка", code="SVC-DELIVERY", unit="усл.", amount=Decimal("50"))

    def test_validate_limits_amount_exceeded(self):
        with self.assertRaises(ValueError):
            validate_items_for_object_limits(
                self.obj,
                [{"product": self.product, "quantity": Decimal("11")}],
            )

    def test_validate_limits_quantity_exceeded(self):
        with self.assertRaises(ValueError):
            validate_items_for_object_limits(
                self.obj,
                [{"product": self.product, "quantity": Decimal("11")}],
            )

    def test_validate_allowed_assortment(self):
        self.object_type.allowed_products.add(self.product)
        self.object_type.allowed_services.add(self.service)
        validate_items_for_object_limits(
            self.obj,
            [{"product": self.product, "quantity": Decimal("1")}],
        )
        validate_items_for_object_limits(
            self.obj,
            [{"service": self.service, "quantity": Decimal("1")}],
        )

    def test_material_request_serializer_accepts_service(self):
        payload = {
            "construction_object": self.obj.id,
            "object_name": "",
            "work_type": "",
            "comment": "",
            "status": "draft",
            "items": [{"service": self.service.id, "quantity": "2.000"}],
        }
        serializer = MaterialRequestCreateSerializer(data=payload)
        self.assertTrue(serializer.is_valid(), serializer.errors)
