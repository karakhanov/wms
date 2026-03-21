from django.utils import timezone
from rest_framework import permissions, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from users.mixins import SetAuditUserMixin

from .models import Notification
from .serializers import NotificationSerializer


class NotificationViewSet(SetAuditUserMixin, viewsets.ReadOnlyModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = Notification.objects.filter(recipient=self.request.user).select_related("created_by")
        is_read = self.request.query_params.get("is_read")
        if is_read in ("true", "false"):
            qs = qs.filter(is_read=(is_read == "true"))
        return qs

    @action(detail=True, methods=["post"], url_path="read")
    def mark_read(self, request, pk=None):
        obj = self.get_object()
        if not obj.is_read:
            obj.is_read = True
            obj.read_at = timezone.now()
            obj.save(update_fields=["is_read", "read_at", "updated_at", "updated_by"])
        return Response(self.get_serializer(obj).data)

    @action(detail=False, methods=["post"], url_path="read-all")
    def read_all(self, request):
        now = timezone.now()
        self.get_queryset().filter(is_read=False).update(is_read=True, read_at=now, updated_at=now)
        return Response({"ok": True})

    @action(detail=False, methods=["get"], url_path="unread-count")
    def unread_count(self, request):
        count = self.get_queryset().filter(is_read=False).count()
        return Response({"count": count})
