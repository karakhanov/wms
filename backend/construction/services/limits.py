from decimal import Decimal
from django.db.models import Sum
from orders.models import IssueNote, IssueNoteItem


def get_effective_limits(construction_object):
    if not construction_object:
        return {"limit_amount": None, "limit_quantity": None}
    object_type = getattr(construction_object, "object_type", None)
    limit_amount = construction_object.limit_amount_override
    limit_quantity = construction_object.limit_quantity_override
    if limit_amount is None and object_type:
        limit_amount = object_type.limit_amount
    if limit_quantity is None and object_type:
        limit_quantity = object_type.limit_quantity
    return {"limit_amount": limit_amount, "limit_quantity": limit_quantity}


def validate_items_for_object_limits(construction_object, items):
    """
    items: iterable of dicts with keys:
      - quantity (Decimal)
      - product (optional Product instance)
      - service (optional Service instance)
    """
    if not construction_object:
        return

    object_type = getattr(construction_object, "object_type", None)
    limits = get_effective_limits(construction_object)

    total_quantity = Decimal("0")
    total_amount = Decimal("0")
    for item in items:
        qty = Decimal(item.get("quantity") or 0)
        total_quantity += qty
        product = item.get("product")
        service = item.get("service")
        if product:
            total_amount += Decimal(product.amount or 0) * qty
        elif service:
            total_amount += Decimal(service.amount or 0) * qty

    if limits["limit_quantity"] is not None and total_quantity > limits["limit_quantity"]:
        raise ValueError("Превышен лимит количества для объекта.")
    if limits["limit_amount"] is not None and total_amount > limits["limit_amount"]:
        raise ValueError("Превышен лимит суммы для объекта.")

    if object_type:
        per_item_limits = {}
        for lim in object_type.item_limits.all():
            key = ("product", lim.product_id) if lim.product_id else ("service", lim.service_id)
            per_item_limits[key] = lim.limit_quantity

        if per_item_limits:
            consumed_rows = (
                IssueNoteItem.objects.filter(
                    issue_note__construction_object=construction_object,
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
                    consumed_map[("product", row["product_id"])] = Decimal(row["total_qty"] or 0)
                elif row["service_id"]:
                    consumed_map[("service", row["service_id"])] = Decimal(row["total_qty"] or 0)

            requested_map = {}
            for item in items:
                qty = Decimal(item.get("quantity") or 0)
                product = item.get("product")
                service = item.get("service")
                key = ("product", product.id) if product else ("service", service.id)
                requested_map[key] = requested_map.get(key, Decimal("0")) + qty

            for key, requested_qty in requested_map.items():
                if key not in per_item_limits:
                    raise ValueError("Позиция не разрешена лимитами типа объекта.")
                consumed_qty = consumed_map.get(key, Decimal("0"))
                allowed_qty = Decimal(per_item_limits[key] or 0)
                if consumed_qty + requested_qty > allowed_qty:
                    raise ValueError("Превышен лимит по позиции для данного типа объекта.")

        allowed_products = set(object_type.allowed_products.values_list("id", flat=True))
        allowed_services = set(object_type.allowed_services.values_list("id", flat=True))
        products_restricted = bool(allowed_products)
        services_restricted = bool(allowed_services)
        for item in items:
            product = item.get("product")
            service = item.get("service")
            if product and products_restricted and product.id not in allowed_products:
                raise ValueError(f"Товар '{product.name}' не разрешен для типа объекта.")
            if service and services_restricted and service.id not in allowed_services:
                raise ValueError(f"Услуга '{service.name}' не разрешена для типа объекта.")
