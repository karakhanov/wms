"""
Middleware: текущий пользователь (audit) и язык API из Accept-Language.
"""
from rest_framework import status
from rest_framework.response import Response
from django.utils import translation
from django.conf import settings

from .audit import set_current_user
from .models import ActionLog
from .request_meta import client_ip, device_name


class APILanguageMiddleware:
    """Для запросов к /api/ выставляет язык из заголовка Accept-Language (ru, uz, en)."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.path.startswith("/api/"):
            lang = request.META.get("HTTP_ACCEPT_LANGUAGE", "").split(",")[0].strip()[:2]
            if lang in dict(settings.LANGUAGES):
                translation.activate(lang)
        response = self.get_response(request)
        return response


class AuditCurrentUserMiddleware:
    """Сохраняет request.user в контекст перед обработкой запроса и сбрасывает после."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        set_current_user(request.user if request.user.is_authenticated else None)
        try:
            response = self.get_response(request)
            self._write_action_log(request, response)
            return response
        finally:
            set_current_user(None)

    def _write_action_log(self, request, response):
        if not request.path.startswith("/api/"):
            return
        if not getattr(request, "user", None) or not request.user.is_authenticated:
            return
        if request.path.startswith("/api/auth/action-log/"):
            return
        if request.path in ("/api/auth/token/", "/api/auth/logout/"):
            return
        path = request.path.strip("/")
        parts = path.split("/")
        page = parts[1] if len(parts) > 1 else ""
        model_name = parts[2] if len(parts) > 2 else ""
        object_id = parts[3] if len(parts) > 3 and parts[3].isdigit() else ""
        user_agent = request.META.get("HTTP_USER_AGENT", "")[:1000]
        ActionLog.objects.create(
            action=f"{request.method} {request.path}",
            model_name=model_name,
            object_id=object_id,
            page=page,
            method=request.method,
            status_code=getattr(response, "status_code", None),
            ip_address=client_ip(request),
            user_agent=user_agent,
            device=device_name(user_agent),
            details={"query": dict(request.GET), "path": request.path},
        )


class ReadOnlyRoleGuardMiddleware:
    """
    Запрещает любые mutating API-методы для read-only ролей.
    Используется для профилей руководства: полный просмотр без изменений данных.
    """

    READ_ONLY_ROLE_NAMES = {"executive_readonly"}
    READ_ONLY_USERNAMES = {"bashkent1"}
    ALLOWED_MUTATING_PATHS = {"/api/auth/logout/"}

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if (
            request.path.startswith("/api/")
            and request.method not in ("GET", "HEAD", "OPTIONS")
            and request.path not in self.ALLOWED_MUTATING_PATHS
            and getattr(request, "user", None)
            and request.user.is_authenticated
            and (
                getattr(getattr(request.user, "role", None), "name", None) in self.READ_ONLY_ROLE_NAMES
                or getattr(request.user, "username", "") in self.READ_ONLY_USERNAMES
            )
        ):
            return Response(
                {"detail": "Профиль только для просмотра. Изменение данных запрещено."},
                status=status.HTTP_403_FORBIDDEN,
            )
        return self.get_response(request)
