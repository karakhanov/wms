from rest_framework import viewsets, permissions
from django_filters.rest_framework import DjangoFilterBackend
from users.mixins import SetAuditUserMixin
from .models import Order, OrderItem
from .serializers import OrderSerializer, OrderCreateSerializer
from stock.models import StockBalance


class OrderViewSet(SetAuditUserMixin, viewsets.ModelViewSet):
    queryset = Order.objects.all().select_related("created_by").prefetch_related("items__product")
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ("status", "created_at")

    def get_serializer_class(self):
        if self.action == "create":
            return OrderCreateSerializer
        return OrderSerializer

    def perform_update(self, serializer):
        order = serializer.save()
        # При переходе в "Отправлен" — списать остатки (упрощённо: по первой доступной ячейке)
        if order.status == Order.Status.SHIPPED:
            for item in order.items.all():
                balances = StockBalance.objects.filter(product=item.product, quantity__gt=0).order_by("updated_at")
                remaining = item.quantity
                for balance in balances:
                    if remaining <= 0:
                        break
                    take = min(remaining, balance.quantity)
                    balance.quantity -= take
                    balance.save(update_fields=["quantity", "updated_at"])
                    remaining -= take
