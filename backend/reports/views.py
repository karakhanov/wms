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
from orders.models import IssueNoteItem, IssueNote
from construction.models import ConstructionObject, ConstructionObjectTypeItemLimit


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
            .annotate(
                total_qty=Sum("quantity"), 
                total_amount=Sum("quantity"),
                count=Count("id")
            )
            .order_by("-total_qty")[:limit]
        )
        pids = [x["product"] for x in popular]
        pmap = {p.id: p for p in Product.objects.filter(id__in=pids)}
        for x in popular:
            p = pmap.get(x["product"])
            x["product_name"] = p.name if p else ""
            x["product_sku"] = p.sku if p else ""
            x["total_qty"] = float(x["total_qty"])
            x["total_amount"] = float(x.get("total_amount", 0))

        recent_receipts = (
            Receipt.objects.select_related("created_by", "supplier")
            .order_by("-created_at")[:limit]
        )
        recent_orders = (
            Order.objects.select_related("created_by")
            .order_by("-created_at")[:limit]
        )

        # Get period counts (last 30 days by default)
        from_date = timezone.now() - timedelta(days=30)
        receipts_period = Receipt.objects.filter(created_at__gte=from_date).count()
        orders_period = Order.objects.filter(created_at__gte=from_date).count()
        active_orders = Order.objects.exclude(status__in=["shipped", "cancelled"]).count()
        transfers_period = Transfer.objects.filter(created_at__gte=from_date).count()

        # Stock by category for pie chart
        stock_by_category = list(
            StockBalance.objects
            .select_related("product__category")
            .values("product__category__name")
            .annotate(quantity=Coalesce(Sum("quantity"), Value(0), output_field=DecimalField(max_digits=14, decimal_places=3)))
            .filter(quantity__gt=0)
            .order_by("-quantity")
        )
        # Format for frontend
        stock_by_category = [
            {
                "category": row["product__category__name"] or "Other",
                "quantity": float(row["quantity"] or 0),
            }
            for row in stock_by_category
        ]

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
                "receipts_period": receipts_period,
                "orders_period": orders_period,
                "active_orders": active_orders,
                "transfers_period": transfers_period,
            },
            "recent_receipts": ReceiptListSerializer(recent_receipts, many=True).data,
            "recent_orders": OrderListSerializer(recent_orders, many=True).data,
            "popular": popular,
            "shortage": shortage,
            "stock_by_category": stock_by_category,
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


class ReportObjectLimitsSummary(SetAuditUserMixin, APIView):
    """
    Краткий дашборд по объектам и лимитам:
    - сколько лимитных позиций у объекта,
    - сколько из них превышено,
    - максимальный процент использования.
    """

    permission_classes = [AnyAuthenticatedRole]

    def get(self, request):
        objects = list(
            ConstructionObject.objects.select_related("object_type")
            .filter(is_active=True, object_type__isnull=False, object_type__is_active=True)
            .order_by("name")
        )
        type_ids = {o.object_type_id for o in objects}
        limits = list(
            ConstructionObjectTypeItemLimit.objects.filter(object_type_id__in=type_ids)
            .values("object_type_id", "product_id", "service_id", "limit_quantity")
        )
        consumed = list(
            IssueNoteItem.objects.filter(
                issue_note__construction_object_id__in=[o.id for o in objects],
                issue_note__status__in=[
                    IssueNote.Status.APPROVED,
                    IssueNote.Status.PICKING,
                    IssueNote.Status.READY_PICKUP,
                    IssueNote.Status.WAREHOUSE_RECEIVED_CLOSED,
                    IssueNote.Status.NOTE_COMPLETED,
                ],
            )
            .values("issue_note__construction_object_id", "product_id", "service_id")
            .annotate(total_qty=Sum("quantity"))
        )
        consumed_map = {}
        for row in consumed:
            key = (
                row["issue_note__construction_object_id"],
                "product" if row["product_id"] else "service",
                row["product_id"] or row["service_id"],
            )
            consumed_map[key] = float(row["total_qty"] or 0)

        limits_by_type = {}
        for l in limits:
            key = ("product" if l["product_id"] else "service", l["product_id"] or l["service_id"])
            limits_by_type.setdefault(l["object_type_id"], {})[key] = float(l["limit_quantity"] or 0)

        out = []
        for obj in objects:
            obj_limits = limits_by_type.get(obj.object_type_id, {})
            total_items = len(obj_limits)
            exceeded = 0
            max_util = 0.0
            for key, lim_qty in obj_limits.items():
                consumed_qty = consumed_map.get((obj.id, key[0], key[1]), 0.0)
                util = (consumed_qty / lim_qty * 100.0) if lim_qty > 0 else 0.0
                max_util = max(max_util, util)
                if consumed_qty > lim_qty:
                    exceeded += 1
            out.append(
                {
                    "object_id": obj.id,
                    "object_name": obj.name,
                    "object_type_id": obj.object_type_id,
                    "object_type_name": obj.object_type.name if obj.object_type_id else None,
                    "limits_total": total_items,
                    "limits_exceeded": exceeded,
                    "max_utilization_percent": round(max_util, 2),
                }
            )
        return Response(out)


class ReportObjectLimitsDetail(SetAuditUserMixin, APIView):
    permission_classes = [AnyAuthenticatedRole]

    def get(self, request, object_id: int):
        obj = ConstructionObject.objects.select_related("object_type").filter(id=object_id).first()
        if not obj:
            return Response({"detail": "Объект не найден."}, status=404)
        if not obj.object_type_id:
            return Response([])

        limits = list(
            ConstructionObjectTypeItemLimit.objects.filter(object_type=obj.object_type)
            .select_related("product", "service")
            .order_by("id")
        )
        consumed_rows = list(
            IssueNoteItem.objects.filter(
                issue_note__construction_object_id=obj.id,
                issue_note__status__in=[
                    IssueNote.Status.APPROVED,
                    IssueNote.Status.PICKING,
                    IssueNote.Status.READY_PICKUP,
                    IssueNote.Status.WAREHOUSE_RECEIVED_CLOSED,
                    IssueNote.Status.NOTE_COMPLETED,
                ],
            )
            .values("product_id", "service_id")
            .annotate(total_qty=Sum("quantity"))
        )
        consumed_map = {}
        for row in consumed_rows:
            if row["product_id"]:
                consumed_map[("product", row["product_id"])] = float(row["total_qty"] or 0)
            elif row["service_id"]:
                consumed_map[("service", row["service_id"])] = float(row["total_qty"] or 0)

        out = []
        for lim in limits:
            is_product = bool(lim.product_id)
            entity_id = lim.product_id or lim.service_id
            key = ("product" if is_product else "service", entity_id)
            consumed_qty = consumed_map.get(key, 0.0)
            limit_qty = float(lim.limit_quantity or 0)
            remaining = limit_qty - consumed_qty
            util = (consumed_qty / limit_qty * 100.0) if limit_qty > 0 else 0.0
            out.append(
                {
                    "kind": "product" if is_product else "service",
                    "entity_id": entity_id,
                    "label": (
                        f"{lim.product.sku} - {lim.product.name}"
                        if is_product
                        else f"{lim.service.code} - {lim.service.name}"
                    ),
                    "limit_quantity": limit_qty,
                    "consumed_quantity": round(consumed_qty, 3),
                    "remaining_quantity": round(remaining, 3),
                    "utilization_percent": round(util, 2),
                    "is_exceeded": consumed_qty > limit_qty,
                }
            )
        return Response(out)
