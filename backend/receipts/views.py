from rest_framework import viewsets, permissions
from django_filters.rest_framework import DjangoFilterBackend
from users.mixins import SetAuditUserMixin
from .models import Supplier, Receipt, ReceiptItem
from .serializers import SupplierSerializer, ReceiptSerializer, ReceiptCreateSerializer


class SupplierViewSet(SetAuditUserMixin, viewsets.ModelViewSet):
    queryset = Supplier.objects.all()
    serializer_class = SupplierSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend]


class ReceiptViewSet(SetAuditUserMixin, viewsets.ModelViewSet):
    queryset = Receipt.objects.all().select_related("created_by", "supplier").prefetch_related("items__product", "items__cell")
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ("supplier", "created_at")

    def get_serializer_class(self):
        if self.action == "create":
            return ReceiptCreateSerializer
        return ReceiptSerializer
