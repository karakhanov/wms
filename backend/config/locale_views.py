"""
API выбора языка: список языков (ru, uz, en).
Язык для ответов API задаётся заголовком Accept-Language.
"""
from django.conf import settings
from django.http import JsonResponse
from django.utils import translation
from django.views import View
from django.views.decorators.http import require_GET


@require_GET
def language_list(request):
    """Список доступных языков."""
    return JsonResponse({
        "languages": [
            {"code": code, "name": name}
            for code, name in settings.LANGUAGES
        ],
        "current": translation.get_language() or "ru",
    })


class SetLanguageView(View):
    """Установить язык для сессии (GET ?lang=ru|uz|en)."""

    def get(self, request):
        lang = request.GET.get("lang")
        if lang and lang in dict(settings.LANGUAGES):
            translation.activate(lang)
            if hasattr(request, "session"):
                request.session[translation.LANGUAGE_SESSION_KEY] = lang
        return JsonResponse({"language": translation.get_language()})
