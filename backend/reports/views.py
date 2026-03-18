"""
Отчёты и история: движение, приход, отгрузка, популярные товары, недостачи.
"""
from rest_framework import permissions
from rest_framework.views import APIView
from users.mixins import SetAuditUserMixin
from rest_framework.response import Response
from django.db.models import Sum, Count
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
from datetime import timedelta

from receipts.models import ReceiptItem
from orders.models import OrderItem
from stock.models import StockBalance, MinStockLevel
from products.models import Product


class ReportMovement(SetAuditUserMixin, APIView):
    """Отчёт: движение товаров за период."""
    permission_classes = [permissions.IsAuthenticated]

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
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        levels = MinStockLevel.objects.filter(notify=True).select_related("product")
        shortage = []
        for level in levels:
            total = StockBalance.objects.filter(product=level.product).aggregate(s=Sum("quantity"))["s"] or 0
            if total < level.min_quantity:
                shortage.append({
                    "product_id": level.product_id,
                    "product_sku": level.product.sku,
                    "product_name": level.product.name,
                    "min_quantity": float(level.min_quantity),
                    "current": float(total),
                })
        return Response(shortage)


class ReportPopular(SetAuditUserMixin, APIView):
    """Отчёт: популярные товары (по отгрузкам)."""
    permission_classes = [permissions.IsAuthenticated]

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
