from rest_framework import viewsets
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend
from users.mixins import SetAuditUserMixin
from users.permissions import StorekeeperOnly
from .models import Transfer, TransferItem
from .serializers import TransferSerializer, TransferCreateSerializer


class TransferViewSet(SetAuditUserMixin, viewsets.ModelViewSet):
    queryset = Transfer.objects.all().select_related("created_by").prefetch_related(
        "items__product", "items__cell_from", "items__cell_to"
    )
    permission_classes = [StorekeeperOnly]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ("created_at",)
    search_fields = ("comment", "created_by__username")
    ordering_fields = ("id", "created_at")
    ordering = ("-created_at",)

    def get_serializer_class(self):
        if self.action == "create":
            return TransferCreateSerializer
        return TransferSerializer
