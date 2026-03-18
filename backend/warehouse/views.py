from rest_framework import viewsets, permissions
from django_filters.rest_framework import DjangoFilterBackend
from users.mixins import SetAuditUserMixin
from .models import Warehouse, Zone, Rack, Cell
from .serializers import (
    WarehouseSerializer, ZoneSerializer, ZoneListSerializer,
    RackSerializer, RackListSerializer, CellSerializer, CellListSerializer,
)

class WarehouseViewSet(SetAuditUserMixin, viewsets.ModelViewSet):
    queryset = Warehouse.objects.all().prefetch_related("zones__racks__cells")
    serializer_class = WarehouseSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ("is_active",)


class ZoneViewSet(SetAuditUserMixin, viewsets.ModelViewSet):
    queryset = Zone.objects.all().select_related("warehouse").prefetch_related("racks__cells")
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ("warehouse",)

    def get_serializer_class(self):
        if self.action in ("list", "retrieve"):
            return ZoneListSerializer
        return ZoneSerializer


class RackViewSet(SetAuditUserMixin, viewsets.ModelViewSet):
    queryset = Rack.objects.all().select_related("zone").prefetch_related("cells")
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ("zone",)

    def get_serializer_class(self):
        if self.action in ("list", "retrieve"):
            return RackListSerializer
        return RackSerializer


class CellViewSet(SetAuditUserMixin, viewsets.ModelViewSet):
    queryset = Cell.objects.all().select_related("rack")
    serializer_class = CellListSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ("rack", "is_active")

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return CellSerializer
        return CellListSerializer
