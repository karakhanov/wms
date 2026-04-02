from rest_framework import viewsets
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Q, Sum
from users.mixins import SetAuditUserMixin
from users.permissions import AdminManager, AnyAuthenticatedRole
from .models import Category, Product, Unit, Service
from .serializers import CategorySerializer, ProductSerializer, UnitSerializer, ServiceSerializer
from stock.models import StockBalance, MinStockLevel
from warehouse.models import Warehouse
from receipts.models import ReceiptItem
from orders.models import Order, OrderItem
from transfers.models import TransferItem
from inventory.models import InventoryItem


class CategoryViewSet(SetAuditUserMixin, viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [AdminManager]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ("parent",)
    search_fields = ("name",)
    ordering_fields = ("id", "name", "created_at")
    ordering = ("name",)

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [AnyAuthenticatedRole()]
        return [AdminManager()]


class ProductViewSet(SetAuditUserMixin, viewsets.ModelViewSet):
    queryset = Product.objects.all().select_related("category")
    serializer_class = ProductSerializer
    permission_classes = [AdminManager]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ("category", "is_active")
    search_fields = ("name", "sku", "barcode", "description")
    ordering_fields = ("id", "name", "sku", "amount", "created_at")
    ordering = ("name",)

    def get_permissions(self):
        if self.action in ("list", "retrieve", "history"):
            return [AnyAuthenticatedRole()]
        return [AdminManager()]

    @action(detail=True, methods=["get"], url_path="history")
    def history(self, request, pk=None):
        limit = int(request.query_params.get("limit", 20))
        from_date = request.query_params.get("from")
        to_date = request.query_params.get("to")

        # Пагинация по документам (используем общий limit как дефолт)
        receipts_limit = int(request.query_params.get("receipts_limit", limit))
        receipts_offset = int(request.query_params.get("receipts_offset", 0))
        shipments_limit = int(request.query_params.get("shipments_limit", limit))
        shipments_offset = int(request.query_params.get("shipments_offset", 0))
        transfers_limit = int(request.query_params.get("transfers_limit", limit))
        transfers_offset = int(request.query_params.get("transfers_offset", 0))
        inventories_limit = int(request.query_params.get("inventories_limit", limit))
        inventories_offset = int(request.query_params.get("inventories_offset", 0))

        balances_limit = int(request.query_params.get("balances_limit", limit))
        product = self.get_object()

        # По складам: хотим видеть и те склады, где товара нет (0),
        # поэтому строим словарь по наличиям и дополняем нулями по всем складам.
        balances_by_wh_qs = (
            StockBalance.objects.filter(product=product, quantity__gt=0)
            .values("cell__rack__zone__warehouse__name")
            .annotate(quantity=Sum("quantity"))
        )
        balances_by_wh_map = {r["cell__rack__zone__warehouse__name"]: r["quantity"] for r in balances_by_wh_qs}
        all_wh_names = list(Warehouse.objects.order_by("name").values_list("name", flat=True))
        balances_by_wh = [
            {"warehouse_name": wh_name, "quantity": balances_by_wh_map.get(wh_name, 0)}
            for wh_name in all_wh_names
        ]
        balances_cells = (
            StockBalance.objects.filter(product=product, quantity__gt=0)
            .select_related("cell__rack__zone__warehouse", "cell__rack__zone", "cell__rack")
            .order_by("-updated_at")[: max(1, balances_limit * 10)]
        )
        min_level = MinStockLevel.objects.filter(product=product).first()

        def _apply_date_filter(qs, field_created_at__date):
            if from_date and to_date:
                return qs.filter(**{f"{field_created_at__date}__range": [from_date, to_date]})
            if from_date:
                return qs.filter(**{f"{field_created_at__date}__gte": from_date})
            if to_date:
                return qs.filter(**{f"{field_created_at__date}__lte": to_date})
            return qs

        receipts_qs = ReceiptItem.objects.filter(product=product).select_related(
            "receipt", "receipt__supplier", "cell"
        )
        shipments_qs = OrderItem.objects.filter(product=product, order__status=Order.Status.SHIPPED).select_related(
            "order", "cell"
        )
        transfers_qs = TransferItem.objects.filter(product=product).select_related(
            "transfer", "cell_from", "cell_to"
        )
        inventories_qs = InventoryItem.objects.filter(product=product).select_related(
            "inventory", "inventory__warehouse", "cell"
        )

        receipts_qs = _apply_date_filter(receipts_qs, "receipt__created_at__date")
        shipments_qs = _apply_date_filter(shipments_qs, "order__created_at__date")
        transfers_qs = _apply_date_filter(transfers_qs, "transfer__created_at__date")
        inventories_qs = _apply_date_filter(inventories_qs, "inventory__created_at__date")

        receipts_search = request.query_params.get("receipts_q", "").strip()
        shipments_search = request.query_params.get("shipments_q", "").strip()
        transfers_search = request.query_params.get("transfers_q", "").strip()
        inventories_search = request.query_params.get("inventories_q", "").strip()
        if receipts_search:
            receipts_qs = receipts_qs.filter(receipt__supplier__name__icontains=receipts_search)
        if shipments_search:
            shipments_qs = shipments_qs.filter(order__client_name__icontains=shipments_search)
        if transfers_search:
            transfers_qs = transfers_qs.filter(
                Q(transfer__comment__icontains=transfers_search)
                | Q(cell_from__name__icontains=transfers_search)
                | Q(cell_to__name__icontains=transfers_search)
            )
        if inventories_search:
            inventories_qs = inventories_qs.filter(
                inventory__warehouse__name__icontains=inventories_search
            )

        receipts_total = receipts_qs.count() if receipts_limit > 0 else 0
        shipments_total = shipments_qs.count() if shipments_limit > 0 else 0
        transfers_total = transfers_qs.count() if transfers_limit > 0 else 0
        inventories_total = inventories_qs.count() if inventories_limit > 0 else 0

        receipts = (
            receipts_qs.order_by("-created_at")[receipts_offset : receipts_offset + receipts_limit]
            if receipts_limit > 0
            else []
        )
        shipments = (
            shipments_qs.order_by("-created_at")[shipments_offset : shipments_offset + shipments_limit]
            if shipments_limit > 0
            else []
        )
        transfers = (
            transfers_qs.order_by("-created_at")[transfers_offset : transfers_offset + transfers_limit]
            if transfers_limit > 0
            else []
        )
        inventories = (
            inventories_qs.order_by("-created_at")[inventories_offset : inventories_offset + inventories_limit]
            if inventories_limit > 0
            else []
        )

        return_data = {
            "balances_by_warehouse": balances_by_wh,
            "balances": [
                {
                    "warehouse_name": b.cell.rack.zone.warehouse.name,
                    "zone_name": b.cell.rack.zone.name,
                    "rack_name": b.cell.rack.name,
                    "cell_name": b.cell.name,
                    "quantity": b.quantity,
                    "updated_at": b.updated_at,
                }
                for b in balances_cells
            ],
            "min_level": (
                {
                    "min_quantity": min_level.min_quantity,
                    "notify": min_level.notify,
                }
                if min_level
                else None
            ),
            "receipts": [
                {
                    "receipt_id": ri.receipt_id,
                    "date": ri.receipt.created_at,
                    "supplier_name": ri.receipt.supplier.name,
                    "quantity": ri.quantity,
                    "cell_name": ri.cell.name,
                }
                for ri in receipts
            ],
            "receipts_total": receipts_total,
            "shipments": [
                {
                    "order_id": oi.order_id,
                    "date": oi.order.created_at,
                    "client_name": oi.order.client_name,
                    "quantity": oi.quantity,
                    "cell_name": oi.cell.name if oi.cell_id else None,
                }
                for oi in shipments
            ],
            "shipments_total": shipments_total,
            "transfers": [
                {
                    "transfer_id": ti.transfer_id,
                    "date": ti.transfer.created_at,
                    "comment": ti.transfer.comment,
                    "quantity": ti.quantity,
                    "cell_from": ti.cell_from.name if ti.cell_from_id else None,
                    "cell_to": ti.cell_to.name if ti.cell_to_id else None,
                }
                for ti in transfers
            ],
            "transfers_total": transfers_total,
            "inventories": [
                {
                    "inventory_id": ii.inventory_id,
                    "date": ii.inventory.created_at,
                    "warehouse_name": ii.inventory.warehouse.name,
                    "quantity_system": ii.system_quantity,
                    "quantity_actual": ii.actual_quantity,
                    "difference": ii.difference,
                    "cell_name": ii.cell.name if ii.cell_id else None,
                }
                for ii in inventories
            ],
            "inventories_total": inventories_total,
        }

        return Response(return_data)


class UnitViewSet(SetAuditUserMixin, viewsets.ReadOnlyModelViewSet):
    queryset = Unit.objects.filter(is_active=True)
    serializer_class = UnitSerializer
    permission_classes = [AnyAuthenticatedRole]
    filter_backends = [DjangoFilterBackend]


class ServiceViewSet(SetAuditUserMixin, viewsets.ModelViewSet):
    queryset = Service.objects.all()
    serializer_class = ServiceSerializer
    permission_classes = [AdminManager]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ("is_active",)
    search_fields = ("name", "code", "description")
    ordering_fields = ("id", "name", "code", "amount", "created_at")
    ordering = ("name",)

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [AnyAuthenticatedRole()]
        return [AdminManager()]
