"""
Загрузка временных данных для просмотра: роли, пользователи, категории, товары,
склады, поставщики, приёмки, заказы, остатки.
Запуск: python manage.py load_sample_data
"""
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.db import transaction

from users.audit import set_current_user

User = get_user_model()


class Command(BaseCommand):
    help = "Загрузить тестовые данные (роли, пользователи, товары, склад, приёмки, заказы)"

    def add_arguments(self, parser):
        parser.add_argument(
            "--clear-users",
            action="store_true",
            help="Не создавать тестовых пользователей (если уже есть свои)",
        )

    def handle(self, *args, **options):
        with transaction.atomic():
            self._create_roles()
            if not options["clear_users"]:
                self._create_users()
            admin = User.objects.filter(username="admin").first()
            if admin:
                set_current_user(admin)
            self._create_categories_and_products()
            self._create_warehouse()
            self._create_suppliers()
            self._create_receipts_and_stock()
            self._create_orders()
            self._create_transfer()
            self._create_min_stock_levels()
        self.stdout.write(self.style.SUCCESS("Тестовые данные загружены."))

    def _create_roles(self):
        from users.models import Role
        for value, _ in Role.Name.choices:
            Role.objects.get_or_create(name=value)
        self.stdout.write("  Роли: ok")

    def _create_users(self):
        from users.models import Role
        role_admin, _ = Role.objects.get_or_create(name=Role.Name.ADMIN)
        role_manager, _ = Role.objects.get_or_create(name=Role.Name.MANAGER)
        role_sk, _ = Role.objects.get_or_create(name=Role.Name.STOREKEEPER)

        users_data = [
            ("admin", "admin123", "Администратор Системы", role_admin),
            ("manager", "manager123", "Менеджер Иванов", role_manager),
            ("storekeeper", "sk123", "Кладовщик Петров", role_sk),
        ]
        for username, password, full_name, role in users_data:
            user, created = User.objects.get_or_create(
                username=username,
                defaults={"email": f"{username}@wms.local", "full_name": full_name, "role": role},
            )
            if created:
                user.set_password(password)
                user.save()
        self.stdout.write("  Пользователи: admin/admin123, manager/manager123, storekeeper/sk123")

    def _create_categories_and_products(self):
        from products.models import Category, Product
        cat_elec, _ = Category.objects.get_or_create(name="Электроника", defaults={})
        cat_tools, _ = Category.objects.get_or_create(name="Инструменты", defaults={})
        cat_office, _ = Category.objects.get_or_create(name="Канцтовары", defaults={})

        products_data = [
            ("NB-001", "Ноутбук", "4601234567890", cat_elec, "шт", 45000),
            ("MB-002", "Мышь беспроводная", "4601234567891", cat_elec, "шт", 1200),
            ("KB-003", "Клавиатура", "4601234567892", cat_elec, "шт", 2500),
            ("DR-004", "Дрель", "4601234567893", cat_tools, "шт", 3500),
            ("SC-005", "Отвёртка набор", "4601234567894", cat_tools, "шт", 800),
            ("PN-006", "Ручка шариковая", "4601234567895", cat_office, "шт", 25),
            ("PP-007", "Бумага A4", "4601234567896", cat_office, "пачка", 350),
        ]
        for sku, name, barcode, category, unit, amount in products_data:
            Product.objects.get_or_create(
                sku=sku,
                defaults={"name": name, "barcode": barcode, "category": category, "unit": unit, "amount": amount},
            )
        self.stdout.write("  Категории и товары: ok")

    def _create_warehouse(self):
        from warehouse.models import Warehouse, Zone, Rack, Cell
        wh, _ = Warehouse.objects.get_or_create(
            name="Склад основной",
            defaults={"address": "ул. Складская, 1", "is_active": True},
        )
        z1, _ = Zone.objects.get_or_create(warehouse=wh, name="Зона А", defaults={"code": "A"})
        z2, _ = Zone.objects.get_or_create(warehouse=wh, name="Зона Б", defaults={"code": "B"})
        r1, _ = Rack.objects.get_or_create(zone=z1, name="Стеллаж 1", defaults={"code": "A-1"})
        r2, _ = Rack.objects.get_or_create(zone=z1, name="Стеллаж 2", defaults={"code": "A-2"})
        r3, _ = Rack.objects.get_or_create(zone=z2, name="Стеллаж 1", defaults={"code": "B-1"})
        for rack, codes in [(r1, ["A-1-01", "A-1-02", "A-1-03"]), (r2, ["A-2-01", "A-2-02"]), (r3, ["B-1-01"])]:
            for code in codes:
                Cell.objects.get_or_create(rack=rack, name=code, defaults={"code": code})
        self.stdout.write("  Склад (зоны, стеллажи, ячейки): ok")

    def _create_suppliers(self):
        from receipts.models import Supplier
        for name, inn, contact in [
            ("ООО Поставщик Плюс", "7700123456", "+7 495 111-22-33"),
            ("ИП Складской мир", "7700987654", "info@sklad.local"),
        ]:
            Supplier.objects.get_or_create(name=name, defaults={"inn": inn, "contact": contact})
        self.stdout.write("  Поставщики: ok")

    def _create_receipts_and_stock(self):
        from users.models import Role
        from products.models import Product
        from warehouse.models import Cell
        from receipts.models import Receipt, ReceiptItem, Supplier
        from stock.models import StockBalance

        user = User.objects.filter(role__name=Role.Name.STOREKEEPER).first() or User.objects.first()
        set_current_user(user)
        if not user:
            self.stdout.write(self.style.WARNING("  Приёмки: нет пользователя, пропуск"))
            return
        supplier = Supplier.objects.first()
        if not supplier:
            self.stdout.write(self.style.WARNING("  Приёмки: нет поставщика, пропуск"))
            return

        cells = list(Cell.objects.all()[:5])
        products = list(Product.objects.all()[:5])
        if not cells or not products:
            self.stdout.write(self.style.WARNING("  Приёмки: нет ячеек или товаров, пропуск"))
            return

        if Receipt.objects.exists():
            self.stdout.write("  Приёмки: уже есть данные, не дублируем")
            return

        r1 = Receipt.objects.create(supplier=supplier, comment="Тестовая приёмка 1")
        ReceiptItem.objects.create(receipt=r1, product=products[0], cell=cells[0], quantity=10)
        ReceiptItem.objects.create(receipt=r1, product=products[1], cell=cells[1], quantity=20)
        ReceiptItem.objects.create(receipt=r1, product=products[2], cell=cells[0], quantity=5)

        r2 = Receipt.objects.create(supplier=supplier, comment="Тестовая приёмка 2")
        ReceiptItem.objects.create(receipt=r2, product=products[3], cell=cells[2], quantity=15)
        ReceiptItem.objects.create(receipt=r2, product=products[4], cell=cells[3], quantity=30)

        for item in ReceiptItem.objects.filter(receipt__in=[r1, r2]).select_related("product", "cell"):
            bal, _ = StockBalance.objects.get_or_create(
                product=item.product, cell=item.cell, defaults={"quantity": 0}
            )
            bal.quantity += item.quantity
            bal.save(update_fields=["quantity"])

        self.stdout.write("  Приёмки и остатки: ok")

    def _create_orders(self):
        from users.models import Role
        from products.models import Product
        from orders.models import Order, OrderItem
        from stock.models import StockBalance

        user = User.objects.filter(role__name=Role.Name.MANAGER).first() or User.objects.first()
        set_current_user(user)
        if not user:
            return
        products = list(Product.objects.all()[:4])
        if not products:
            return

        if Order.objects.exists():
            self.stdout.write("  Заказы: уже есть данные, не дублируем")
            return

        o1 = Order.objects.create(client_name="ООО Покупатель", comment="Тестовый заказ", status=Order.Status.CREATED)
        OrderItem.objects.create(order=o1, product=products[0], quantity=2)
        OrderItem.objects.create(order=o1, product=products[1], quantity=3)

        o2 = Order.objects.create(client_name="ИП Клиент", comment="Второй заказ", status=Order.Status.PICKING)
        OrderItem.objects.create(order=o2, product=products[2], quantity=1)
        OrderItem.objects.create(order=o2, product=products[3], quantity=5)

        o3 = Order.objects.create(client_name="Магазин №1", status=Order.Status.SHIPPED)
        OrderItem.objects.create(order=o3, product=products[0], quantity=1)
        for item in o3.items.all():
            balances = StockBalance.objects.filter(product=item.product, quantity__gt=0).order_by("updated_at")
            rem = item.quantity
            for bal in balances:
                if rem <= 0:
                    break
                take = min(rem, bal.quantity)
                bal.quantity -= take
                bal.save(update_fields=["quantity"])
                rem -= take

        self.stdout.write("  Заказы: ok")

    def _create_transfer(self):
        from users.models import Role
        from products.models import Product
        from warehouse.models import Cell
        from stock.models import StockBalance
        from transfers.models import Transfer, TransferItem

        user = User.objects.filter(role__name=Role.Name.STOREKEEPER).first() or User.objects.first()
        set_current_user(user)
        if not user:
            return
        balances = list(StockBalance.objects.filter(quantity__gt=0).select_related("product", "cell")[:2])
        if len(balances) < 2:
            self.stdout.write("  Перемещение: недостаточно остатков, пропуск")
            return
        cells = list(Cell.objects.exclude(id=balances[0].cell_id).exclude(id=balances[1].cell_id)[:2])
        if len(cells) < 2:
            return
        if Transfer.objects.exists():
            self.stdout.write("  Перемещение: уже есть данные, не дублируем")
            return

        t = Transfer.objects.create(comment="Тестовое перемещение")
        TransferItem.objects.create(transfer=t, product=balances[0].product, cell_from=balances[0].cell, cell_to=cells[0], quantity=2)
        b_from, _ = StockBalance.objects.get_or_create(product=balances[0].product, cell=balances[0].cell, defaults={"quantity": 0})
        b_from.quantity -= 2
        b_from.save(update_fields=["quantity"])
        b_to, _ = StockBalance.objects.get_or_create(product=balances[0].product, cell=cells[0], defaults={"quantity": 0})
        b_to.quantity += 2
        b_to.save(update_fields=["quantity"])
        self.stdout.write("  Перемещение: ok")

    def _create_min_stock_levels(self):
        from products.models import Product
        from stock.models import MinStockLevel

        products = Product.objects.all()[:3]
        for p in products:
            MinStockLevel.objects.get_or_create(product=p, defaults={"min_quantity": 5, "notify": True})
        self.stdout.write("  Минимальные остатки: ok")
