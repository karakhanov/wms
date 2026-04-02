from rest_framework import viewsets
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Sum
from users.mixins import SetAuditUserMixin
from users.permissions import ManagerStorekeeper, StockBalanceRead
from .models import StockBalance, MinStockLevel
from .serializers import StockBalanceSerializer, MinStockLevelSerializer


class StockBalanceViewSet(SetAuditUserMixin, viewsets.ReadOnlyModelViewSet):
    """Просмотр остатков, поиск товара на складе."""
    queryset = StockBalance.objects.filter(quantity__gt=0).select_related(
        "product",
        "product__category",
        "cell__rack__zone__warehouse",
    )
    serializer_class = StockBalanceSerializer
    permission_classes = [StockBalanceRead]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ("product", "cell", "cell__rack__zone__warehouse")
    search_fields = (
        "product__name",
        "product__sku",
        "product__barcode",
        "cell__name",
        "cell__code",
        "cell__rack__name",
        "cell__rack__zone__name",
        "cell__rack__zone__warehouse__name",
    )
    ordering_fields = (
        "id",
        "quantity",
        "updated_at",
        "product__sku",
        "product__name",
        "product__barcode",
        "product__category__name",
        "product__unit",
        "cell__rack__zone__warehouse__name",
        "cell__rack__zone__name",
    )
    ordering = ("-quantity",)


class MinStockLevelViewSet(SetAuditUserMixin, viewsets.ModelViewSet):
    """Настройка минимального остатка и уведомлений."""
    queryset = MinStockLevel.objects.all().select_related("product")
    serializer_class = MinStockLevelSerializer
    permission_classes = [ManagerStorekeeper]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ("product", "notify")
