from rest_framework import viewsets, permissions
from rest_framework.filters import SearchFilter
from django_filters.rest_framework import DjangoFilterBackend
from users.mixins import SetAuditUserMixin
from .models import Category, Product
from .serializers import CategorySerializer, ProductSerializer


class CategoryViewSet(SetAuditUserMixin, viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ("parent",)


class ProductViewSet(SetAuditUserMixin, viewsets.ModelViewSet):
    queryset = Product.objects.all().select_related("category")
    serializer_class = ProductSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_fields = ("category", "is_active")
    search_fields = ("name", "sku", "barcode")
