from rest_framework import viewsets, permissions
from rest_framework import status
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.utils import timezone
from django.utils.dateparse import parse_date
from datetime import timedelta
from .models import User, Role, ActionLog
from .filters import ActionLogFilter
from .serializers import UserSerializer, UserCreateSerializer, RoleSerializer, ActionLogSerializer
from .mixins import SetAuditUserMixin
from .permissions import get_role_policy, get_user_permissions, DEFAULT_ROLE_POLICY, _user_role_name
from .request_meta import client_ip, device_name


class AuthTokenObtainPairView(TokenObtainPairView):
    serializer_class = TokenObtainPairSerializer

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        ua = request.META.get("HTTP_USER_AGENT", "")[:1000]
        username = (request.data or {}).get("username", "")
        if response.status_code != status.HTTP_200_OK:
            ActionLog.objects.create(
                action="AUTH_LOGIN_FAILED",
                model_name="auth",
                object_id="",
                page="auth",
                method="POST",
                status_code=response.status_code,
                ip_address=client_ip(request),
                user_agent=ua,
                device=device_name(ua),
                details={"event": "login_failed", "username": username},
            )
            return response
        user = User.objects.filter(username=username).first()
        if not user:
            return response
        ActionLog.objects.create(
            created_by=user,
            updated_by=user,
            action="AUTH_LOGIN",
            model_name="auth",
            object_id=str(user.id),
            page="auth",
            method="POST",
            status_code=response.status_code,
            ip_address=client_ip(request),
            user_agent=ua,
            device=device_name(ua),
            details={"event": "login"},
        )
        return response


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def current_user(request):
    """Текущий пользователь для фронтенда после логина."""
    data = UserSerializer(request.user).data
    data["rbac"] = get_user_permissions(request.user)
    return Response(data)


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def activity_view(request):
    page_path = str((request.data or {}).get("page_path") or "").strip()
    page_title = str((request.data or {}).get("page_title") or "").strip()
    if not page_path:
        return Response({"detail": "page_path is required"}, status=400)
    ua = request.META.get("HTTP_USER_AGENT", "")[:1000]
    page_segment = page_path.strip("/").split("/")[0] if page_path.strip("/") else "dashboard"
    ActionLog.objects.create(
        created_by=request.user,
        updated_by=request.user,
        action="PAGE_VIEW",
        model_name="page",
        object_id=page_path[:50],
        page=page_segment[:120],
        method="VIEW",
        status_code=200,
        ip_address=client_ip(request),
        user_agent=ua,
        device=device_name(ua),
        details={"event": "page_view", "page_path": page_path, "page_title": page_title},
    )
    return Response({"ok": True})


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def logout_view(request):
    ua = request.META.get("HTTP_USER_AGENT", "")[:1000]
    ActionLog.objects.create(
        created_by=request.user,
        updated_by=request.user,
        action="AUTH_LOGOUT",
        model_name="auth",
        object_id=str(request.user.id),
        page="auth",
        method="POST",
        status_code=200,
        ip_address=client_ip(request),
        user_agent=ua,
        device=device_name(ua),
        details={"event": "logout"},
    )
    return Response({"ok": True})


@api_view(["GET", "POST"])
@permission_classes([permissions.IsAuthenticated])
def permissions_matrix(request):
    if request.method == "POST":
        role_name = _user_role_name(request.user)
        if role_name != Role.Name.ADMIN:
            return Response({"detail": "Недостаточно прав."}, status=403)
        payload_policy = request.data.get("policy")
        if not isinstance(payload_policy, dict):
            return Response({"detail": "Ожидается объект policy."}, status=400)
        from .models import RolePolicyOverride
        RolePolicyOverride.objects.all().delete()
        valid_roles = set(Role.objects.values_list("name", flat=True))
        for resource, rules in payload_policy.items():
            if resource not in DEFAULT_ROLE_POLICY or not isinstance(rules, dict):
                continue
            read_set = set(rules.get("read", []))
            write_set = set(rules.get("write", []))
            for role in valid_roles:
                RolePolicyOverride.objects.create(
                    role_name=role,
                    resource=resource,
                    can_read=role in read_set,
                    can_write=role in write_set,
                )
        return Response(
            {
                "policy": get_role_policy(),
                "current_user": get_user_permissions(request.user),
            }
        )
    return Response(
        {
            "policy": get_role_policy(),
            "current_user": get_user_permissions(request.user),
        }
    )


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def managers_list(request):
    rows = (
        User.objects.filter(role__name=Role.Name.MANAGER, is_active=True)
        .only("id", "username", "full_name")
        .order_by("username")
    )
    data = [
        {
            "id": u.id,
            "username": u.username,
            "full_name": u.full_name,
            "display_name": (u.full_name or "").strip() or u.username,
        }
        for u in rows
    ]
    return Response(data)


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def controllers_list(request):
    rows = (
        User.objects.filter(role__name=Role.Name.WAREHOUSE_CONTROLLER, is_active=True)
        .only("id", "username", "full_name")
        .order_by("username")
    )
    data = [
        {
            "id": u.id,
            "username": u.username,
            "full_name": u.full_name,
            "display_name": (u.full_name or "").strip() or u.username,
        }
        for u in rows
    ]
    return Response(data)


def is_admin_or_manager(user):
    if not user.is_authenticated:
        return False
    if getattr(user, "is_superuser", False):
        return True
    return user.role and user.role.name in (Role.Name.ADMIN, Role.Name.MANAGER)


class IsAdminOrManager(permissions.BasePermission):
    def has_permission(self, request, view):
        return is_admin_or_manager(request.user)


class IsAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and (
            getattr(request.user, "is_superuser", False)
            or (request.user.role and request.user.role.name == Role.Name.ADMIN)
        )


class RoleViewSet(SetAuditUserMixin, viewsets.ModelViewSet):
    queryset = Role.objects.all()
    serializer_class = RoleSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [permissions.IsAuthenticated(), IsAdminOrManager()]
        return [permissions.IsAuthenticated(), IsAdmin()]


class UserViewSet(SetAuditUserMixin, viewsets.ModelViewSet):
    queryset = User.objects.all().select_related("role")
    permission_classes = [permissions.IsAuthenticated, IsAdminOrManager]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ("role", "is_active")
    search_fields = ("username", "full_name", "email", "first_name", "last_name")
    ordering_fields = ("id", "username", "date_joined", "created_at")
    ordering = ("username",)

    def get_serializer_class(self):
        if self.action == "create":
            return UserCreateSerializer
        return UserSerializer

    def get_permissions(self):
        if self.action in ("destroy", "update", "partial_update"):
            return [permissions.IsAuthenticated(), IsAdmin()]
        return [permissions.IsAuthenticated(), IsAdminOrManager()]

    @action(detail=True, methods=["post"], url_path="assign-objects")
    def assign_objects(self, request, pk=None):
        target = self.get_object()
        actor_role = getattr(getattr(request.user, "role", None), "name", None)
        if actor_role not in (Role.Name.ADMIN, Role.Name.MANAGER):
            return Response({"detail": "Недостаточно прав."}, status=403)
        if not target.role or target.role.name != Role.Name.FOREMAN:
            return Response({"detail": "Назначение объектов доступно только для роли Прораб."}, status=400)
        object_ids = request.data.get("assigned_objects", [])
        if not isinstance(object_ids, list):
            return Response({"detail": "Поле assigned_objects должно быть списком id."}, status=400)
        target.assigned_objects.set(object_ids)
        return Response(UserSerializer(target).data)


class ActionLogViewSet(SetAuditUserMixin, viewsets.ReadOnlyModelViewSet):
    queryset = ActionLog.objects.all().select_related("created_by", "updated_by").order_by("-created_at")
    serializer_class = ActionLogSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = ActionLogFilter
    search_fields = ("action", "model_name", "object_id", "ip_address", "user_agent", "created_by__username")
    ordering_fields = ("id", "created_at", "status_code", "method", "page", "created_by", "device")
    ordering = ("-created_at",)

    def get_queryset(self):
        qs = super().get_queryset()
        if IsAdmin().has_permission(self.request, self):
            base_qs = qs
        else:
            base_qs = qs.filter(created_by=self.request.user)

        auth_only = str(self.request.query_params.get("auth_only", "")).lower() in ("1", "true", "yes")
        if auth_only:
            base_qs = base_qs.filter(model_name="auth")

        period = (self.request.query_params.get("period") or "").strip().lower()
        now = timezone.now()
        delta_map = {"24h": timedelta(hours=24), "7d": timedelta(days=7), "30d": timedelta(days=30)}
        if period in delta_map:
            base_qs = base_qs.filter(created_at__gte=now - delta_map[period])

        date_from = (self.request.query_params.get("date_from") or "").strip()
        date_to = (self.request.query_params.get("date_to") or "").strip()
        df = parse_date(date_from) if date_from else None
        dt = parse_date(date_to) if date_to else None
        if df:
            base_qs = base_qs.filter(created_at__date__gte=df)
        if dt:
            base_qs = base_qs.filter(created_at__date__lte=dt)

        return base_qs

    @action(detail=False, methods=["get"], url_path="facets")
    def facets(self, request):
        """Уникальные разделы и устройства для фильтров (без конфликта с ?page)."""
        qs = self.get_queryset()
        pages = qs.exclude(page="").values_list("page", flat=True).distinct().order_by("page")
        devices = qs.exclude(device="").values_list("device", flat=True).distinct().order_by("device")
        return Response({"pages": list(pages), "devices": list(devices)})
