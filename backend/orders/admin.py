from django.contrib import admin
from .models import (
    Order,
    OrderItem,
    MaterialRequest,
    MaterialRequestItem,
    IssueNote,
    IssueNoteItem,
)


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ("id", "created_at", "created_by", "status", "client_name")
    list_filter = ("status", "created_at")
    inlines = [OrderItemInline]


class MaterialRequestItemInline(admin.TabularInline):
    model = MaterialRequestItem
    extra = 0


@admin.register(MaterialRequest)
class MaterialRequestAdmin(admin.ModelAdmin):
    list_display = ("id", "created_at", "created_by", "status", "object_name", "needed_at")
    list_filter = ("status", "created_at", "needed_at")
    inlines = [MaterialRequestItemInline]


class IssueNoteItemInline(admin.TabularInline):
    model = IssueNoteItem
    extra = 0


@admin.register(IssueNote)
class IssueNoteAdmin(admin.ModelAdmin):
    list_display = ("id", "number", "created_at", "created_by", "request", "recipient_name")
    list_filter = ("created_at",)
    search_fields = ("number", "recipient_name", "request__object_name")
    inlines = [IssueNoteItemInline]
