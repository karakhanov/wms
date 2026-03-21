"""Пагинация API: клиент может задать ?page_size= (до max) для списков и экспорта."""

from rest_framework.pagination import PageNumberPagination


class OptionalPageSizePagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 500
