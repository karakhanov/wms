from rest_framework import viewsets, permissions
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend

from users.mixins import SetAuditUserMixin
from users.models import Role
from users.permissions import AdminManager, AnyAuthenticatedRole
from .models import ConstructionObject
from .serializers import ConstructionObjectSerializer


class ConstructionObjectViewSet(SetAuditUserMixin, viewsets.ModelViewSet):
    queryset = ConstructionObject.objects.all()
    serializer_class = ConstructionObjectSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ("is_active",)
    search_fields = ("name", "code", "address")
    ordering_fields = ("id", "name", "code", "address", "created_at")
    ordering = ("name",)

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
