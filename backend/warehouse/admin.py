from django.contrib import admin
from .models import Warehouse, Zone, Rack, Cell


class ZoneInline(admin.TabularInline):
    model = Zone
    extra = 0


class RackInline(admin.TabularInline):
    model = Rack
    extra = 0


class CellInline(admin.TabularInline):
    model = Cell
    extra = 0


@admin.register(Warehouse)
class WarehouseAdmin(admin.ModelAdmin):
    list_display = ("name", "address", "is_active")
    inlines = [ZoneInline]


@admin.register(Zone)
class ZoneAdmin(admin.ModelAdmin):
    list_display = ("name", "warehouse", "code")
    list_filter = ("warehouse",)
    inlines = [RackInline]


@admin.register(Rack)
class RackAdmin(admin.ModelAdmin):
    list_display = ("name", "zone", "code")
    list_filter = ("zone__warehouse",)
    inlines = [CellInline]


@admin.register(Cell)
class CellAdmin(admin.ModelAdmin):
    list_display = ("name", "rack", "code", "is_active")
    list_filter = ("rack__zone__warehouse",)
