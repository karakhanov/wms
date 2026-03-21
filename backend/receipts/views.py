from rest_framework import viewsets
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend
from users.mixins import SetAuditUserMixin
from users.permissions import ManagerStorekeeper
from .models import Supplier, Receipt, ReceiptItem
from .serializers import (
    SupplierSerializer,
    ReceiptSerializer,
    ReceiptCreateSerializer,
    ReceiptListSerializer,
)


class SupplierViewSet(SetAuditUserMixin, viewsets.ModelViewSet):
    queryset = Supplier.objects.all()
    serializer_class = SupplierSerializer
    permission_classes = [ManagerStorekeeper]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    search_fields = ("name", "inn", "contact")
    ordering_fields = ("id", "name", "created_at")
    ordering = ("name",)


class ReceiptViewSet(SetAuditUserMixin, viewsets.ModelViewSet):
    queryset = Receipt.objects.all().select_related("created_by", "supplier").prefetch_related("items__product", "items__cell")
    permission_classes = [ManagerStorekeeper]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ("supplier", "created_at")
    search_fields = ("comment", "supplier__name", "created_by__username")
    ordering_fields = ("id", "created_at")
    ordering = ("-created_at",)

    def get_queryset(self):
        if getattr(self, "action", None) == "list":
            return Receipt.objects.all().select_related("created_by", "supplier")
        return super().get_queryset()

    def get_serializer_class(self):
        if self.action == "create":
            return ReceiptCreateSerializer
        if self.action == "list":
            return ReceiptListSerializer
        return ReceiptSerializer
