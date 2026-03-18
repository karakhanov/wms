from rest_framework import viewsets, permissions
from django_filters.rest_framework import DjangoFilterBackend
from users.mixins import SetAuditUserMixin
from .models import Transfer, TransferItem
from .serializers import TransferSerializer, TransferCreateSerializer


class TransferViewSet(SetAuditUserMixin, viewsets.ModelViewSet):
    queryset = Transfer.objects.all().select_related("created_by").prefetch_related(
        "items__product", "items__cell_from", "items__cell_to"
    )
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ("created_at",)

    def get_serializer_class(self):
        if self.action == "create":
            return TransferCreateSerializer
        return TransferSerializer
