"""
Middleware: текущий пользователь (audit) и язык API из Accept-Language.
"""
from django.utils import translation
from django.conf import settings

from .audit import set_current_user


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
            return self.get_response(request)
        finally:
            set_current_user(None)
