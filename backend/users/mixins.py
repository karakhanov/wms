"""
Mixin для ViewSet: устанавливает текущего пользователя перед обработкой запроса.
Нужен для API (JWT): request.user появляется только во view, а не в middleware.
"""
from .audit import set_current_user


class SetAuditUserMixin:
    """После аутентификации DRF выставляет текущего пользователя для авто-заполнения created_by/updated_by."""

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        set_current_user(request.user if request.user.is_authenticated else None)
