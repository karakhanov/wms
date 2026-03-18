from rest_framework import serializers
from .models import User, Role, ActionLog


class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = ("id", "name")


class UserSerializer(serializers.ModelSerializer):
    role_display = serializers.SerializerMethodField()
    role_name = serializers.SerializerMethodField()

    def get_role_display(self, obj):
        return obj.role.get_name_display() if obj.role else ""

    def get_role_name(self, obj):
        return obj.role.name if obj.role else None

    class Meta:
        model = User
        fields = (
            "id", "username", "email", "full_name", "role", "role_name", "role_display",
            "is_active", "date_joined", "created_at", "updated_at", "created_by", "updated_by", "state"
        )
        read_only_fields = ("date_joined", "created_at", "updated_at")


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ("username", "email", "password", "full_name", "role")

    def create(self, validated_data):
        user = User.objects.create_user(**validated_data)
        return user


class ActionLogSerializer(serializers.ModelSerializer):
    created_by_username = serializers.CharField(source="created_by.username", read_only=True)

    class Meta:
        model = ActionLog
        fields = (
            "id", "created_at", "updated_at", "created_by", "created_by_username",
            "updated_by", "state", "action", "model_name", "object_id", "details"
        )
