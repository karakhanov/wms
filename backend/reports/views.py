"""
Отчёты и история: движение, приход, отгрузка, популярные товары, недостачи.
"""
from rest_framework.views import APIView
from users.mixins import SetAuditUserMixin
from users.permissions import AdminManager, AnyAuthenticatedRole
from rest_framework.response import Response
from django.core.cache import cache
from django.db.models import Sum, Count, F, DecimalField, Value
from django.db.models.functions import Coalesce
from django.utils import timezone
from datetime import timedelta

from receipts.models import Receipt, ReceiptItem, Supplier
from receipts.serializers import ReceiptListSerializer
from orders.models import Order, OrderItem
from orders.serializers import OrderListSerializer
from stock.models import StockBalance, MinStockLevel
from products.models import Product, Category
from warehouse.models import Warehouse, Cell
from inventory.models import Inventory
from transfers.models import Transfer
from orders.models import IssueNoteItem


def _shortage_list():
    levels = (
        MinStockLevel.objects.filter(notify=True)
        .select_related("product")
        .annotate(
            current=Coalesce(
                Sum("product__stock_balances__quantity"),
                Value(0),
                output_field=DecimalField(max_digits=14, decimal_places=3),
            )
        )
        .filter(current__lt=F("min_quantity"))
    )
    return [
        {
            "product_id": level.product_id,
            "product_sku": level.product.sku,
            "product_name": level.product.name,
            "min_quantity": float(level.min_quantity),
            "current": float(level.current),
        }
        for level in levels
    ]


class ReportMovement(SetAuditUserMixin, APIView):
    """Отчёт: движение товаров за период."""
    permission_classes = [AdminManager]

    def get(self, request):
        from_date = request.query_params.get("from") or (timezone.now() - timedelta(days=30)).isoformat()[:10]
        to_date = request.query_params.get("to") or timezone.now().isoformat()[:10]
        # Упрощённо: приходы и отгрузки за период
        receipts = ReceiptItem.objects.filter(receipt__created_at__date__range=[from_date, to_date])
        in_qty = receipts.values("product").annotate(total=Sum("quantity"))
        orders = OrderItem.objects.filter(order__status="shipped", order__created_at__date__range=[from_date, to_date])
        out_qty = orders.values("product").annotate(total=Sum("quantity"))
        return Response({"receipts": list(in_qty), "shipments": list(out_qty)})


class ReportShortage(SetAuditUserMixin, APIView):
    """Отчёт: товары с нехваткой (ниже минимального остатка)."""
    permission_classes = [AdminManager]

    def get(self, request):
        return Response(_shortage_list())


class ReportPopular(SetAuditUserMixin, APIView):
    """Отчёт: популярные товары (по отгрузкам)."""
    permission_classes = [AdminManager]

    def get(self, request):
        limit = int(request.query_params.get("limit", 20))
        from_date = request.query_params.get("from")
        to_date = request.query_params.get("to")
        qs = OrderItem.objects.filter(order__status="shipped")
        if from_date:
            qs = qs.filter(order__created_at__date__gte=from_date)
        if to_date:
            qs = qs.filter(order__created_at__date__lte=to_date)
        items = list(qs.values("product").annotate(
            total_qty=Sum("quantity"), count=Count("id")
        ).order_by("-total_qty")[:limit])
        product_ids = [x["product"] for x in items]
        products = {p.id: p for p in Product.objects.filter(id__in=product_ids)}
        for x in items:
            p = products.get(x["product"])
            x["product_name"] = p.name if p else ""
            x["product_sku"] = p.sku if p else ""
        return Response(items)


class ReportDashboardSummary(SetAuditUserMixin, APIView):
    """
    Одна выдача для главной: счётчики, последние документы, популярное, нехватка.
    Уменьшает число HTTP-запросов с фронта с ~15 до 1.
    """
    permission_classes = [AnyAuthenticatedRole]

    def get(self, request):
        limit = 8
        lang = getattr(request, "LANGUAGE_CODE", "ru")
        cache_key = f"reports:summary:v1:{lang}:{limit}"
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)

        shortage = _shortage_list()

        popular = list(
            OrderItem.objects.filter(order__status="shipped")
            .values("product")
            .annotate(total_qty=Sum("quantity"), count=Count("id"))
            .order_by("-total_qty")[:limit]
        )
        pids = [x["product"] for x in popular]
        pmap = {p.id: p for p in Product.objects.filter(id__in=pids)}
        for x in popular:
            p = pmap.get(x["product"])
            x["product_name"] = p.name if p else ""
            x["product_sku"] = p.sku if p else ""
            x["total_qty"] = float(x["total_qty"])

        recent_receipts = (
            Receipt.objects.select_related("created_by", "supplier")
            .order_by("-created_at")[:limit]
        )
        recent_orders = (
            Order.objects.select_related("created_by")
            .order_by("-created_at")[:limit]
        )

        data = {
            "counts": {
                "products": Product.objects.count(),
                "categories": Category.objects.count(),
                "suppliers": Supplier.objects.count(),
                "receipts": Receipt.objects.count(),
                "orders": Order.objects.count(),
                "balances": StockBalance.objects.count(),
                "warehouses": Warehouse.objects.count(),
                "cells": Cell.objects.count(),
                "transfers": Transfer.objects.count(),
                "inventories_open": Inventory.objects.filter(is_completed=False).count(),
                "inventories": Inventory.objects.count(),
            },
            "recent_receipts": ReceiptListSerializer(recent_receipts, many=True).data,
            "recent_orders": OrderListSerializer(recent_orders, many=True).data,
            "popular": popular,
            "shortage": shortage,
        }
        cache.set(cache_key, data, timeout=10)
        return Response(data)


class ReportObjectConsumption(SetAuditUserMixin, APIView):
    """Расход материалов по строительным объектам."""

    permission_classes = [AdminManager]

    def get(self, request):
        rows = (
            IssueNoteItem.objects
            .filter(issue_note__request__construction_object__isnull=False)
            .values(
                "issue_note__request__construction_object_id",
                "issue_note__request__construction_object__name",
                "product_id",
                "product__sku",
                "product__name",
            )
            .annotate(total_qty=Sum("quantity"))
            .order_by("issue_note__request__construction_object__name", "product__name")
        )
        data = []
        for r in rows:
            data.append(
                {
                    "object_id": r["issue_note__request__construction_object_id"],
                    "object_name": r["issue_note__request__construction_object__name"],
                    "product_id": r["product_id"],
                    "product_sku": r["product__sku"],
                    "product_name": r["product__name"],
                    "total_qty": float(r["total_qty"] or 0),
                }
            )
        return Response(data)
