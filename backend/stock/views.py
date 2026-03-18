from rest_framework import viewsets, permissions
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Sum
from users.mixins import SetAuditUserMixin
from .models import StockBalance, MinStockLevel
from .serializers import StockBalanceSerializer, MinStockLevelSerializer


class StockBalanceViewSet(SetAuditUserMixin, viewsets.ReadOnlyModelViewSet):
    """Просмотр остатков, поиск товара на складе."""
    queryset = StockBalance.objects.filter(quantity__gt=0).select_related("product", "cell")
    serializer_class = StockBalanceSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ("product", "cell", "cell__rack__zone__warehouse")


class MinStockLevelViewSet(SetAuditUserMixin, viewsets.ModelViewSet):
    """Настройка минимального остатка и уведомлений."""
    queryset = MinStockLevel.objects.all().select_related("product")
    serializer_class = MinStockLevelSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ("product", "notify")
