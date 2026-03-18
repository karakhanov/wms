from rest_framework import viewsets, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView
from .models import User, Role, ActionLog
from .serializers import UserSerializer, UserCreateSerializer, RoleSerializer, ActionLogSerializer
from .mixins import SetAuditUserMixin


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def current_user(request):
    """Текущий пользователь для фронтенда после логина."""
    return Response(UserSerializer(request.user).data)


def is_admin_or_manager(user):
    if not user.is_authenticated:
        return False
    return user.role and user.role.name in (Role.Name.ADMIN, Role.Name.MANAGER)


class IsAdminOrManager(permissions.BasePermission):
    def has_permission(self, request, view):
        return is_admin_or_manager(request.user)


class IsAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role and request.user.role.name == Role.Name.ADMIN


class RoleViewSet(SetAuditUserMixin, viewsets.ReadOnlyModelViewSet):
    queryset = Role.objects.all()
    serializer_class = RoleSerializer
    permission_classes = [permissions.IsAuthenticated]


class UserViewSet(SetAuditUserMixin, viewsets.ModelViewSet):
    queryset = User.objects.all().select_related("role")
    permission_classes = [permissions.IsAuthenticated, IsAdminOrManager]

    def get_serializer_class(self):
        if self.action == "create":
            return UserCreateSerializer
        return UserSerializer

    def get_permissions(self):
        if self.action in ("destroy", "update", "partial_update"):
            return [permissions.IsAuthenticated(), IsAdmin()]
        return [permissions.IsAuthenticated(), IsAdminOrManager()]


class ActionLogViewSet(SetAuditUserMixin, viewsets.ReadOnlyModelViewSet):
    queryset = ActionLog.objects.all().select_related("created_by", "updated_by").order_by("-created_at")
    serializer_class = ActionLogSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrManager]
    filterset_fields = ("created_by", "action", "model_name", "state")
