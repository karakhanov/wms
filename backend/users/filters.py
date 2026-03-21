"""Фильтры для журнала действий (имя query ≠ поле модели, чтобы не конфликтовать с ?page пагинации)."""

from django_filters import rest_framework as filters

from .models import ActionLog


class ActionLogFilter(filters.FilterSet):
    """`section` — фильтр по полю `page` (раздел). Параметр `page` зарезервирован под номер страницы DRF."""

    section = filters.CharFilter(field_name="page", lookup_expr="exact")

    class Meta:
        model = ActionLog
        fields = ("created_by", "method", "status_code", "device", "state")
