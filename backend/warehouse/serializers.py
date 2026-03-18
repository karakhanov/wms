from rest_framework import serializers
from .models import Warehouse, Zone, Rack, Cell


class CellSerializer(serializers.ModelSerializer):
    class Meta:
        model = Cell
        fields = ("id", "name", "code", "rack", "is_active")


class RackSerializer(serializers.ModelSerializer):
    cells = CellSerializer(many=True, read_only=True)

    class Meta:
        model = Rack
        fields = ("id", "name", "code", "zone", "cells")


class ZoneSerializer(serializers.ModelSerializer):
    racks = RackSerializer(many=True, read_only=True)

    class Meta:
        model = Zone
        fields = ("id", "name", "code", "warehouse", "racks")


class WarehouseSerializer(serializers.ModelSerializer):
    zones = ZoneSerializer(many=True, read_only=True)

    class Meta:
        model = Warehouse
        fields = ("id", "name", "address", "is_active", "zones", "created_at")


class ZoneListSerializer(serializers.ModelSerializer):
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)

    class Meta:
        model = Zone
        fields = ("id", "name", "code", "warehouse", "warehouse_name")


class RackListSerializer(serializers.ModelSerializer):
    zone_name = serializers.CharField(source="zone.name", read_only=True)

    class Meta:
        model = Rack
        fields = ("id", "name", "code", "zone", "zone_name")


class CellListSerializer(serializers.ModelSerializer):
    rack_name = serializers.CharField(source="rack.name", read_only=True)

    class Meta:
        model = Cell
        fields = ("id", "name", "code", "rack", "rack_name", "is_active")
