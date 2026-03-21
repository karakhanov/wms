from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from users.mixins import SetAuditUserMixin
from users.permissions import AdminStorekeeper
from .models import Inventory, InventoryItem, InventoryAdjustment
from .serializers import InventorySerializer, InventoryCreateSerializer
from stock.models import StockBalance


class InventoryViewSet(SetAuditUserMixin, viewsets.ModelViewSet):
    queryset = Inventory.objects.all().select_related("created_by", "warehouse").prefetch_related("items__product", "items__cell")
    permission_classes = [AdminStorekeeper]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ("warehouse", "is_completed", "created_at")
    search_fields = ("comment", "warehouse__name", "created_by__username")
    ordering_fields = ("id", "created_at", "is_completed")
    ordering = ("-created_at",)

    def get_serializer_class(self):
        if self.action == "create":
            return InventoryCreateSerializer
        return InventorySerializer

    @action(detail=True, methods=["post"], url_path="apply")
    def apply_adjustment(self, request, pk=None):
        """Применить корректировку остатков по инвентаризации."""
        inv = self.get_object()
        if inv.is_completed:
            return Response({"detail": "Инвентаризация уже применена."}, status=400)
        for item in inv.items.all():
            balance, _ = StockBalance.objects.get_or_create(product=item.product, cell=item.cell, defaults={"quantity": 0})
            balance.quantity = item.actual_quantity
            balance.save(update_fields=["quantity", "updated_at"])
        inv.is_completed = True
        inv.save(update_fields=["is_completed"])
        InventoryAdjustment.objects.create(inventory=inv, applied_by=request.user)
        return Response({"status": "ok"})
