from rest_framework import viewsets, permissions, status
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework.parsers import JSONParser, MultiPartParser, FormParser
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from users.mixins import SetAuditUserMixin
from users.models import Role
from users.permissions import AdminManager, AnyAuthenticatedRole
from .models import ConstructionObject, ConstructionObjectType, ConstructionObjectTypeItemLimit
from .serializers import (
    ConstructionObjectSerializer,
    ConstructionObjectTypeSerializer,
    ConstructionObjectTypeItemLimitSerializer,
)


class ConstructionObjectTypeViewSet(SetAuditUserMixin, viewsets.ModelViewSet):
    queryset = ConstructionObjectType.objects.all()
    serializer_class = ConstructionObjectTypeSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ("is_active",)
    search_fields = ("name", "code", "description")
    ordering_fields = ("id", "name", "code", "created_at")
    ordering = ("name",)
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [permissions.IsAuthenticated(), AnyAuthenticatedRole()]
        return [permissions.IsAuthenticated(), AdminManager()]

    @action(detail=True, methods=["post"], parser_classes=[MultiPartParser, FormParser])
    def upload_photo(self, request, pk=None):
        obj = self.get_object()
        photo = request.FILES.get("photo")
        if not photo:
            return Response({"detail": "Файл не передан."}, status=status.HTTP_400_BAD_REQUEST)
        obj.photo = photo
        obj.save(update_fields=["photo", "updated_at"])
        return Response(self.get_serializer(obj).data, status=status.HTTP_200_OK)


class ConstructionObjectViewSet(SetAuditUserMixin, viewsets.ModelViewSet):
    queryset = ConstructionObject.objects.all().select_related("object_type")
    serializer_class = ConstructionObjectSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ("is_active",)
    search_fields = ("name", "code", "address")
    ordering_fields = ("id", "name", "code", "address", "created_at")
    ordering = ("name",)
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        role_name = getattr(getattr(user, "role", None), "name", None)
        if role_name == Role.Name.FOREMAN or (role_name is None and user.assigned_objects.exists()):
            return qs.filter(assigned_users=user)
        return qs

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [permissions.IsAuthenticated(), AnyAuthenticatedRole()]
        return [permissions.IsAuthenticated(), AdminManager()]

    @action(detail=True, methods=["post"], parser_classes=[MultiPartParser, FormParser])
    def upload_photo(self, request, pk=None):
        obj = self.get_object()
        photo = request.FILES.get("photo")
        if not photo:
            return Response({"detail": "Файл не передан."}, status=status.HTTP_400_BAD_REQUEST)
        obj.photo = photo
        obj.save(update_fields=["photo", "updated_at"])
        return Response(self.get_serializer(obj).data, status=status.HTTP_200_OK)


class ConstructionObjectTypeItemLimitViewSet(SetAuditUserMixin, viewsets.ModelViewSet):
    queryset = ConstructionObjectTypeItemLimit.objects.select_related("object_type", "product", "service")
    serializer_class = ConstructionObjectTypeItemLimitSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ("object_type", "product", "service")
    search_fields = ("object_type__name", "product__name", "product__sku", "service__name", "service__code")
    ordering_fields = ("id", "object_type__name", "limit_quantity", "created_at")
    ordering = ("object_type__name", "id")

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [permissions.IsAuthenticated(), AnyAuthenticatedRole()]
        return [permissions.IsAuthenticated(), AdminManager()]
