from rest_framework import serializers

from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    created_by_username = serializers.CharField(source="created_by.username", read_only=True)

    class Meta:
        model = Notification
        fields = (
            "id",
            "type",
            "title",
            "message",
            "payload",
            "entity_type",
            "entity_id",
            "is_read",
            "read_at",
            "created_at",
            "created_by_username",
        )
