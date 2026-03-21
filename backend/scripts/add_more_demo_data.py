from decimal import Decimal
import random
from django.contrib.auth import get_user_model
from django.db import transaction

from products.models import Product, Category
from receipts.models import Supplier, Receipt, ReceiptItem
from orders.models import Order, OrderItem
from stock.models import StockBalance, MinStockLevel
from warehouse.models import Warehouse, Cell
from transfers.models import Transfer, TransferItem
from inventory.models import Inventory, InventoryItem


User = get_user_model()


def first_or_none(qs):
    try:
        return qs.first()
    except Exception:
        return None


def ensure_base_refs():
    category = first_or_none(Category.objects.all())
    supplier = first_or_none(Supplier.objects.all())
    warehouse = first_or_none(Warehouse.objects.all())
    user = first_or_none(User.objects.all())
    cells = list(Cell.objects.all())
    return category, supplier, warehouse, user, cells


def count_map():
    return {
        "products": Product.objects.count(),
        "suppliers": Supplier.objects.count(),
        "receipts": Receipt.objects.count(),
        "orders": Order.objects.count(),
        "transfers": Transfer.objects.count(),
        "inventory": Inventory.objects.count(),
        "balances": StockBalance.objects.count(),
    }


@transaction.atomic
def run():
    before = count_map()
    category, base_supplier, warehouse, user, cells = ensure_base_refs()
    if not category or not warehouse or not user or len(cells) < 2:
        raise RuntimeError("Not enough base references (category/warehouse/user/cells).")

    # 1) extra suppliers
    new_suppliers = []
    for i in range(1, 9):
        s, created = Supplier.objects.get_or_create(
            name=f"Тест Поставщик {i:02d}",
            defaults={
                "inn": f"77{random.randint(10000000, 99999999)}",
                "contact": f"+998 90 {random.randint(100,999)} {random.randint(10,99)} {random.randint(10,99)}",
            },
        )
        if created:
            new_suppliers.append(s)

    suppliers_pool = [base_supplier] if base_supplier else []
    suppliers_pool.extend(list(Supplier.objects.all()[:20]))

    # 2) extra products
    new_products = []
    for i in range(1, 41):
        sku = f"EX-{i:04d}"
        p, created = Product.objects.get_or_create(
            sku=sku,
            defaults={
                "name": f"Тестовый товар {i:03d}",
                "barcode": f"978{random.randint(1000000000, 9999999999)}",
                "category": category,
                "unit": "шт",
                "amount": Decimal(random.randint(50, 15000)),
                "is_active": True,
            },
        )
        if created:
            new_products.append(p)
            MinStockLevel.objects.get_or_create(
                product=p,
                defaults={"min_quantity": Decimal(random.randint(2, 20)), "notify": True},
            )

    products_pool = list(Product.objects.all()[:120])
    random.shuffle(products_pool)

    # 3) receipts + stock
    for r_idx in range(1, 13):
        supplier = random.choice(suppliers_pool) if suppliers_pool else None
        if not supplier:
            continue
        receipt = Receipt.objects.create(
            supplier=supplier,
            comment=f"Авто-добавление партии #{r_idx}",
            created_by=user,
            updated_by=user,
        )
        lines = random.randint(3, 6)
        used_products = random.sample(products_pool, k=min(lines, len(products_pool)))
        for p in used_products:
            cell = random.choice(cells)
            qty = Decimal(random.randint(2, 40))
            ReceiptItem.objects.create(
                receipt=receipt,
                product=p,
                cell=cell,
                quantity=qty,
                created_by=user,
                updated_by=user,
            )
            bal, _ = StockBalance.objects.get_or_create(product=p, cell=cell, defaults={"quantity": 0})
            bal.quantity += qty
            bal.save(update_fields=["quantity", "updated_at"])

    # 4) orders
    statuses = [Order.Status.CREATED, Order.Status.PICKING, Order.Status.SHIPPED]
    for o_idx in range(1, 17):
        status = random.choice(statuses)
        order = Order.objects.create(
            status=status,
            client_name=f"Клиент {o_idx:02d}",
            comment=f"Авто-заказ #{o_idx}",
            created_by=user,
            updated_by=user,
        )
        lines = random.randint(2, 5)
        used_products = random.sample(products_pool, k=min(lines, len(products_pool)))
        for p in used_products:
            qty = Decimal(random.randint(1, 7))
            OrderItem.objects.create(
                order=order,
                product=p,
                quantity=qty,
                created_by=user,
                updated_by=user,
            )

        if status == Order.Status.SHIPPED:
            for item in order.items.all():
                balances = StockBalance.objects.filter(product=item.product, quantity__gt=0).order_by("updated_at")
                remaining = item.quantity
                for bal in balances:
                    if remaining <= 0:
                        break
                    take = min(remaining, bal.quantity)
                    bal.quantity -= take
                    bal.save(update_fields=["quantity", "updated_at"])
                    remaining -= take

    # 5) transfers
    for t_idx in range(1, 9):
        transfer = Transfer.objects.create(
            comment=f"Авто-перемещение #{t_idx}",
            created_by=user,
            updated_by=user,
        )
        lines = random.randint(2, 4)
        used_products = random.sample(products_pool, k=min(lines, len(products_pool)))
        for p in used_products:
            from_cell = random.choice(cells)
            to_cell = random.choice([c for c in cells if c.id != from_cell.id])
            qty = Decimal(random.randint(1, 6))
            TransferItem.objects.create(
                transfer=transfer,
                product=p,
                cell_from=from_cell,
                cell_to=to_cell,
                quantity=qty,
                created_by=user,
                updated_by=user,
            )
            bal_from, _ = StockBalance.objects.get_or_create(product=p, cell=from_cell, defaults={"quantity": 0})
            bal_to, _ = StockBalance.objects.get_or_create(product=p, cell=to_cell, defaults={"quantity": 0})
            if bal_from.quantity >= qty:
                bal_from.quantity -= qty
                bal_to.quantity += qty
                bal_from.save(update_fields=["quantity", "updated_at"])
                bal_to.save(update_fields=["quantity", "updated_at"])

    # 6) inventory documents
    for i_idx in range(1, 7):
        inv = Inventory.objects.create(
            warehouse=warehouse,
            comment=f"Авто-инвентаризация #{i_idx}",
            is_completed=(i_idx % 2 == 0),
            created_by=user,
            updated_by=user,
        )
        lines = random.randint(3, 6)
        used_products = random.sample(products_pool, k=min(lines, len(products_pool)))
        for p in used_products:
            cell = random.choice(cells)
            bal = first_or_none(StockBalance.objects.filter(product=p, cell=cell))
            system_qty = bal.quantity if bal else Decimal(0)
            drift = Decimal(random.choice([-2, -1, 0, 1, 2]))
            actual_qty = max(Decimal(0), system_qty + drift)
            InventoryItem.objects.create(
                inventory=inv,
                product=p,
                cell=cell,
                system_quantity=system_qty,
                actual_quantity=actual_qty,
                created_by=user,
                updated_by=user,
            )

    after = count_map()
    print("Added demo data:")
    for key in before.keys():
        delta = after[key] - before[key]
        print(f"  {key}: {before[key]} -> {after[key]} ( +{delta} )")


run()
