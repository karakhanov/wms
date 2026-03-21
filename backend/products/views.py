from rest_framework import viewsets
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend
from users.mixins import SetAuditUserMixin
from users.permissions import AdminManager, AnyAuthenticatedRole
from .models import Category, Product, Unit
from .serializers import CategorySerializer, ProductSerializer, UnitSerializer


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
        if self.action in ("list", "retrieve"):
            return [AnyAuthenticatedRole()]
        return [AdminManager()]


class UnitViewSet(SetAuditUserMixin, viewsets.ReadOnlyModelViewSet):
    queryset = Unit.objects.filter(is_active=True)
    serializer_class = UnitSerializer
    permission_classes = [AnyAuthenticatedRole]
    filter_backends = [DjangoFilterBackend]
