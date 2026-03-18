"""
Текущий пользователь в контексте запроса — для автоматического заполнения
created_by и updated_by при сохранении моделей.
"""
import contextvars

_current_user = contextvars.ContextVar("audit_current_user", default=None)


def get_current_user():
    """Вернуть пользователя из контекста запроса (или None вне запроса)."""
    return _current_user.get()


def set_current_user(user):
    """Установить текущего пользователя (вызывается middleware)."""
    _current_user.set(user)
