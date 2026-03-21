from rest_framework import serializers

from .models import ConstructionObject


class ConstructionObjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConstructionObject
        fields = ("id", "name", "code", "address", "is_active")
