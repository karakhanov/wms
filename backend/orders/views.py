import json
from datetime import date
from decimal import Decimal, InvalidOperation
from uuid import uuid4

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.db.models import Count, Prefetch, Q
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from notifications.services import (
    notify_foreman_issue_note_warehouse_received,
    notify_foreman_procurement_shortage,
    notify_goods_awaiting_controller,
    notify_issue_note_decision,
    notify_issue_note_ready_pickup,
    notify_issue_note_received_foreman,
    notify_issue_note_sent_procurement,
    notify_issue_note_submitted,
    notify_managers_assign_controllers,
    notify_procurement_declined,
    notify_storekeepers_issue_note_approved_picking,
)
from stock.models import StockBalance
from warehouse.models import Cell
from users.mixins import SetAuditUserMixin
from users.models import Role
from users.permissions import AnyAuthenticatedRole, ManagerStorekeeper

from receipts.models import Supplier

from .models import Order, OrderItem, MaterialRequest, MaterialRequestItem, IssueNote, IssueNoteItem
from .serializers import (
    AssignInspectionSerializer,
    ControllerCompleteSerializer,
    IssueNoteCreateSerializer,
    IssueNoteSerializer,
    IssueNoteUpdateSerializer,
    MaterialRequestCreateSerializer,
    MaterialRequestListSerializer,
    MaterialRequestSerializer,
    OrderCreateSerializer,
    OrderListSerializer,
    OrderSerializer,
)


def _deduct_stock_for_issue_note(note):
    for item in note.items.select_related("product", "request_item", "cell"):
        quantity = item.actual_quantity if item.actual_quantity is not None else item.quantity
        product = item.product
        selected_cell = item.cell
        if selected_cell:
            cell_balance = StockBalance.objects.filter(product=product, cell=selected_cell).first()
            available = cell_balance.quantity if cell_balance else 0
            if available < quantity:
                raise ValidationError(f"Недостаточно остатка в выбранной ячейке для товара {product.sku}.")
            cell_balance.quantity -= quantity
            cell_balance.save(update_fields=["quantity", "updated_at"])
        else:
            balances = StockBalance.objects.filter(product=product, quantity__gt=0).order_by("updated_at")
            to_take = quantity
            for balance in balances:
                if to_take <= 0:
                    break
                take = min(to_take, balance.quantity)
                balance.quantity -= take
                balance.save(update_fields=["quantity", "updated_at"])
                to_take -= take
            if to_take > 0:
                raise ValidationError(f"Недостаточно остатка для товара {product.sku}.")
        if item.request_item:
            item.request_item.issued_quantity += quantity
            item.request_item.save(update_fields=["issued_quantity", "updated_at"])


def _issue_note_data(note, request):
    return IssueNoteSerializer(note, context={"request": request}).data


def _can_user_inspect(note, user):
    if not user or not user.is_authenticated:
        return False
    if getattr(user, "is_superuser", False):
        return True
    role_name = getattr(getattr(user, "role", None), "name", None)
    if role_name == Role.Name.ADMIN:
        return True
    if role_name != Role.Name.WAREHOUSE_CONTROLLER:
        return False
    if not note.inspection_invited_users.exists():
        return True
    return note.inspection_invited_users.filter(id=user.id).exists()


def _default_procurement_item_ids(note):
    items = list(note.items.all().order_by("id"))
    if not items:
        return []
    if len(items) == 1:
        return [items[0].id]
    product_ids = {i.product_id for i in items}
    if len(product_ids) == 1:
        return [i.id for i in items]
    return None


def _normalize_procurement_item_ids(raw, valid_ids):
    if raw is None:
        return []
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except json.JSONDecodeError:
            raise ValidationError("Некорректный список позиций закупки.")
    if not isinstance(raw, list):
        raise ValidationError("Список позиций закупки должен быть массивом id.")
    out = []
    for x in raw:
        try:
            out.append(int(x))
        except (TypeError, ValueError):
            raise ValidationError("Некорректный id позиции накладной.")
    if not set(out).issubset(valid_ids):
        raise ValidationError("Указаны позиции, не входящие в накладную.")
    seen = set()
    uniq = []
    for i in out:
        if i not in seen:
            seen.add(i)
            uniq.append(i)
    return uniq


def _procurement_required_errors(note):
    errs = []
    if not note.procurement_purchase_date:
        errs.append("Укажите дату закупки.")
    if not (note.procurement_quantity_note or "").strip():
        errs.append("Укажите количество (комментарий).")
    if not note.procurement_supplier_id:
        errs.append("Выберите поставщика из справочника.")
    raw_ids = note.procurement_item_ids or []
    valid = set(note.items.values_list("id", flat=True))
    if not raw_ids:
        errs.append("Укажите, какие товары из накладной везут (позиции закупки).")
    elif not set(raw_ids).issubset(valid):
        errs.append("Некорректный список позиций закупки.")
    return errs


def _apply_default_procurement_items_if_needed(note):
    valid = set(note.items.values_list("id", flat=True))
    current = note.procurement_item_ids or []
    if current and set(current).issubset(valid):
        return False
    default = _default_procurement_item_ids(note)
    if default is not None:
        note.procurement_item_ids = default
        return True
    return False


def _absolute_media_url(request, relative_path):
    rel = f"{settings.MEDIA_URL.rstrip('/')}/{str(relative_path).lstrip('/')}"
    return request.build_absolute_uri("/" + rel.lstrip("/"))


def _save_inspection_uploads(request, note_id, item_id):
    urls = []
    for f in request.FILES.getlist(f"photos_{item_id}"):
        path = default_storage.save(
            f"inspection/{note_id}/{item_id}/{uuid4().hex}_{f.name}",
            ContentFile(f.read()),
        )
        urls.append(_absolute_media_url(request, path))
    return urls


class OrderViewSet(SetAuditUserMixin, viewsets.ModelViewSet):
    queryset = Order.objects.all().select_related("created_by").prefetch_related("items__product")
    permission_classes = [ManagerStorekeeper]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ("status", "created_at")
    search_fields = ("client_name", "comment", "created_by__username")
    ordering_fields = ("id", "created_at", "status", "client_name")
    ordering = ("-created_at",)

    def get_queryset(self):
        if getattr(self, "action", None) == "list":
            return Order.objects.all().select_related("created_by")
        return super().get_queryset()

    def get_serializer_class(self):
        if self.action == "create":
            return OrderCreateSerializer
        if self.action == "list":
            return OrderListSerializer
        return OrderSerializer

    def perform_update(self, serializer):
        order = serializer.save()
        # При переходе в "Отправлен" — списать остатки (упрощённо: по первой доступной ячейке)
        if order.status == Order.Status.SHIPPED:
            for item in order.items.all():
                balances = StockBalance.objects.filter(product=item.product, quantity__gt=0).order_by("updated_at")
                remaining = item.quantity
                for balance in balances:
                    if remaining <= 0:
                        break
                    take = min(remaining, balance.quantity)
                    balance.quantity -= take
                    balance.save(update_fields=["quantity", "updated_at"])
                    remaining -= take


class MaterialRequestViewSet(SetAuditUserMixin, viewsets.ModelViewSet):
    queryset = MaterialRequest.objects.all().select_related("created_by", "approved_by").prefetch_related("items__product")
    permission_classes = [AnyAuthenticatedRole]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ("status", "created_at", "needed_at", "construction_object")
    search_fields = ("object_name", "construction_object__name", "work_type", "comment", "created_by__username")
    ordering_fields = ("id", "created_at", "status", "needed_at")
    ordering = ("-created_at",)

    def get_queryset(self):
        qs = super().get_queryset()
        role_name = getattr(getattr(self.request.user, "role", None), "name", None)
        if role_name == Role.Name.FOREMAN:
            return qs.filter(created_by=self.request.user)
        return qs

    def get_serializer_class(self):
        if self.action == "create":
            return MaterialRequestCreateSerializer
        if self.action == "list":
            return MaterialRequestListSerializer
        return MaterialRequestSerializer

    def perform_create(self, serializer):
        role_name = getattr(getattr(self.request.user, "role", None), "name", None)
        if role_name not in (Role.Name.ADMIN, Role.Name.MANAGER, Role.Name.FOREMAN):
            raise PermissionDenied("Создавать заявки могут администратор, менеджер и прораб.")
        if role_name == Role.Name.FOREMAN:
            obj = serializer.validated_data.get("construction_object")
            if not obj:
                raise PermissionDenied("Прораб должен выбрать закрепленный объект.")
            if not self.request.user.assigned_objects.filter(id=obj.id).exists():
                raise PermissionDenied("Прораб может создавать заявки только по закрепленным объектам.")
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        instance = self.get_object()
        role_name = getattr(getattr(self.request.user, "role", None), "name", None)
        new_status = serializer.validated_data.get("status", instance.status)

        if role_name == Role.Name.FOREMAN:
            if instance.created_by_id != self.request.user.id:
                raise PermissionDenied("Прораб может изменять только свои заявки.")
            new_obj = serializer.validated_data.get("construction_object", instance.construction_object)
            if not new_obj:
                raise PermissionDenied("Прораб должен выбрать закрепленный объект.")
            if not self.request.user.assigned_objects.filter(id=new_obj.id).exists():
                raise PermissionDenied("Прораб может работать только с закрепленными объектами.")
            if instance.status in (MaterialRequest.Status.APPROVED, MaterialRequest.Status.ISSUED):
                raise PermissionDenied("Нельзя изменять уже одобренную/выданную заявку.")
            if new_status in (MaterialRequest.Status.APPROVED, MaterialRequest.Status.REJECTED, MaterialRequest.Status.ISSUED):
                raise PermissionDenied("Прораб не может менять статус на этапах согласования/выдачи.")
            serializer.save()
            return

        if new_status in (MaterialRequest.Status.APPROVED, MaterialRequest.Status.REJECTED):
            if role_name not in (Role.Name.ADMIN, Role.Name.MANAGER):
                raise PermissionDenied("Согласовывать заявки могут администратор и менеджер.")
            serializer.save(approved_by=self.request.user, approved_at=timezone.now())
            return

        serializer.save()


class IssueNoteViewSet(SetAuditUserMixin, viewsets.ModelViewSet):
    queryset = IssueNote.objects.all().select_related(
        "created_by", "request", "procurement_supplier"
    ).prefetch_related(
        Prefetch(
            "items",
            queryset=IssueNoteItem.objects.select_related("product__category", "cell"),
        ),
        "inspection_invited_users",
    )
    permission_classes = [AnyAuthenticatedRole]
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ("request", "construction_object", "status", "created_at")
    search_fields = ("number", "recipient_name", "request__object_name", "construction_object__name", "created_by__username")
    ordering_fields = ("id", "created_at", "number", "status")
    ordering = ("-created_at",)

    def get_queryset(self):
        qs = super().get_queryset().select_related("construction_object", "approved_by")
        role_name = getattr(getattr(self.request.user, "role", None), "name", None)
        if role_name == Role.Name.FOREMAN:
            u = self.request.user
            q = Q(created_by=u)
            assigned_ids = list(u.assigned_objects.values_list("id", flat=True))
            if assigned_ids:
                q |= Q(construction_object_id__in=assigned_ids)
            return qs.filter(q).distinct()
        if role_name == Role.Name.WAREHOUSE_CONTROLLER:
            u = self.request.user
            return (
                qs.annotate(_invited_n=Count("inspection_invited_users", distinct=True))
                .filter(
                    ~Q(status=IssueNote.Status.AWAITING_CONTROLLER)
                    | Q(_invited_n=0)
                    | Q(inspection_invited_users=u)
                )
                .distinct()
            )
        return qs

    def get_serializer_class(self):
        if self.action == "create":
            return IssueNoteCreateSerializer
        if self.action in ("update", "partial_update"):
            return IssueNoteUpdateSerializer
        return IssueNoteSerializer

    @action(detail=False, methods=["get"], url_path="next-number")
    def next_number(self, request):
        next_id = (IssueNote.objects.order_by("-id").values_list("id", flat=True).first() or 0) + 1
        return Response({"number": f"IN-{next_id:06d}"})

    @action(detail=True, methods=["post"], url_path="send-to-procurement")
    def send_to_procurement(self, request, pk=None):
        note = self.get_object()
        role_name = getattr(getattr(request.user, "role", None), "name", None)
        if role_name not in (Role.Name.ADMIN, Role.Name.MANAGER):
            raise PermissionDenied("Передавать в снабжение могут только менеджер или администратор.")
        if note.status != IssueNote.Status.SUBMITTED:
            raise ValidationError("Передать в снабжение можно только накладную на согласовании.")
        text = (request.data.get("procurement_notes") or "").strip()
        if not text:
            raise ValidationError("Укажите комментарий для снабжения (например, причину нехватки).")
        note.status = IssueNote.Status.AWAITING_PROCUREMENT
        note.procurement_notes = text
        note.save(update_fields=["status", "procurement_notes", "updated_at"])
        notify_issue_note_sent_procurement(note, actor=request.user)
        notify_foreman_procurement_shortage(note, actor=request.user)
        return Response(_issue_note_data(note, request))

    @action(detail=True, methods=["post"], url_path="procurement-decline")
    def procurement_decline(self, request, pk=None):
        note = self.get_object()
        role_name = getattr(getattr(request.user, "role", None), "name", None)
        if not getattr(request.user, "is_superuser", False) and role_name not in (
            Role.Name.ADMIN,
            Role.Name.PROCUREMENT,
        ):
            raise PermissionDenied("Отказ по закупке может оформить снабжение или администратор.")
        if note.status not in (IssueNote.Status.AWAITING_PROCUREMENT, IssueNote.Status.PROCUREMENT_ACTIVE):
            raise ValidationError("Неверный статус накладной для отказа снабжения.")
        rejection_comment = (request.data.get("rejection_comment") or "").strip()
        if not rejection_comment:
            raise ValidationError("Укажите причину отказа.")
        note.status = IssueNote.Status.NOTE_COMPLETED
        note.rejection_comment = rejection_comment
        note.approved_by = request.user
        note.approved_at = timezone.now()
        note.save(
            update_fields=["status", "rejection_comment", "approved_by", "approved_at", "updated_at"]
        )
        notify_procurement_declined(note, actor=request.user)
        return Response(_issue_note_data(note, request))

    @action(detail=True, methods=["post"], url_path="procurement-proceed")
    def procurement_proceed(self, request, pk=None):
        note = self.get_object()
        role_name = getattr(getattr(request.user, "role", None), "name", None)
        if not getattr(request.user, "is_superuser", False) and role_name not in (
            Role.Name.ADMIN,
            Role.Name.PROCUREMENT,
        ):
            raise PermissionDenied("Подтвердить закупку может снабжение или администратор.")
        if note.status != IssueNote.Status.AWAITING_PROCUREMENT:
            raise ValidationError("Подтверждение закупки доступно только в статусе «У снабжения».")
        save_fields = ["status", "updated_at"]
        if _apply_default_procurement_items_if_needed(note):
            save_fields.insert(0, "procurement_item_ids")
        errs = _procurement_required_errors(note)
        if errs:
            raise ValidationError("; ".join(errs))
        note.status = IssueNote.Status.PROCUREMENT_ACTIVE
        note.save(update_fields=save_fields)
        return Response(_issue_note_data(note, request))

    @action(detail=True, methods=["post", "patch"], url_path="procurement-details")
    def procurement_details(self, request, pk=None):
        note = self.get_object()
        role_name = getattr(getattr(request.user, "role", None), "name", None)
        if not getattr(request.user, "is_superuser", False) and role_name not in (
            Role.Name.ADMIN,
            Role.Name.PROCUREMENT,
        ):
            raise PermissionDenied("Данные закупки заполняет снабжение или администратор.")
        if note.status not in (IssueNote.Status.AWAITING_PROCUREMENT, IssueNote.Status.PROCUREMENT_ACTIVE):
            raise ValidationError("Реквизиты закупки доступны в статусах «У снабжения» и «Закупка».")

        d = request.data
        uf = []

        if "procurement_purchase_date" in d:
            raw = d.get("procurement_purchase_date")
            if raw in (None, ""):
                note.procurement_purchase_date = None
            else:
                try:
                    note.procurement_purchase_date = date.fromisoformat(str(raw).strip()[:10])
                except ValueError:
                    raise ValidationError("Некорректная дата закупки.")
            uf.append("procurement_purchase_date")

        if "procurement_amount" in d:
            raw = d.get("procurement_amount")
            if raw in (None, ""):
                note.procurement_amount = None
            else:
                try:
                    note.procurement_amount = Decimal(str(raw).replace(",", ".").strip())
                except (InvalidOperation, ValueError):
                    raise ValidationError("Некорректная сумма.")
            uf.append("procurement_amount")

        if "procurement_quantity_note" in d:
            note.procurement_quantity_note = str(d.get("procurement_quantity_note") or "")[:255]
            uf.append("procurement_quantity_note")
        if "procurement_counterparty" in d:
            note.procurement_counterparty = str(d.get("procurement_counterparty") or "")[:255]
            uf.append("procurement_counterparty")
        if "procurement_supplier" in d:
            sid = d.get("procurement_supplier")
            if sid in (None, ""):
                note.procurement_supplier_id = None
            else:
                try:
                    sid_int = int(sid)
                except (TypeError, ValueError):
                    raise ValidationError("Некорректный поставщик.")
                if not Supplier.objects.filter(pk=sid_int).exists():
                    raise ValidationError("Поставщик не найден.")
                note.procurement_supplier_id = sid_int
            uf.append("procurement_supplier_id")
        if "procurement_item_ids" in d:
            raw = d.get("procurement_item_ids")
            valid = set(note.items.values_list("id", flat=True))
            if raw in (None, ""):
                note.procurement_item_ids = []
            else:
                note.procurement_item_ids = _normalize_procurement_item_ids(raw, valid)
            uf.append("procurement_item_ids")
        if "procurement_vehicle" in d:
            note.procurement_vehicle = str(d.get("procurement_vehicle") or "")[:255]
            uf.append("procurement_vehicle")
        if "procurement_delivery_notes" in d:
            note.procurement_delivery_notes = str(d.get("procurement_delivery_notes") or "")
            uf.append("procurement_delivery_notes")

        if "procurement_scan" in request.FILES:
            note.procurement_scan = request.FILES["procurement_scan"]
            uf.append("procurement_scan")

        if note.procurement_supplier_id:
            sup = Supplier.objects.filter(pk=note.procurement_supplier_id).first()
            if sup and not (note.procurement_counterparty or "").strip():
                note.procurement_counterparty = sup.name[:255]
                if "procurement_counterparty" not in uf:
                    uf.append("procurement_counterparty")

        if not uf:
            return Response(_issue_note_data(note, request))
        uf.append("updated_at")
        note.save(update_fields=uf)
        return Response(_issue_note_data(note, request))

    @action(detail=True, methods=["post"], url_path="goods-arrived")
    def goods_arrived(self, request, pk=None):
        note = self.get_object()
        role_name = getattr(getattr(request.user, "role", None), "name", None)
        if not getattr(request.user, "is_superuser", False) and role_name not in (
            Role.Name.ADMIN,
            Role.Name.PROCUREMENT,
        ):
            raise PermissionDenied("Отметить приход может снабжение или администратор.")
        if note.status != IssueNote.Status.PROCUREMENT_ACTIVE:
            raise ValidationError("Отметка прихода доступна только в статусе «Закупка».")
        errs = _procurement_required_errors(note)
        if errs:
            raise ValidationError("; ".join(errs))
        note.inspection_invited_users.clear()
        note.status = IssueNote.Status.AWAIT_CTRL_PICK
        note.save(update_fields=["status", "updated_at"])
        notify_managers_assign_controllers(note, actor=request.user)
        return Response(_issue_note_data(note, request))

    @action(detail=True, methods=["post"], url_path="assign-inspection")
    def assign_inspection(self, request, pk=None):
        note = self.get_object()
        role_name = getattr(getattr(request.user, "role", None), "name", None)
        if role_name not in (Role.Name.ADMIN, Role.Name.MANAGER) and not getattr(request.user, "is_superuser", False):
            raise PermissionDenied("Назначать контролёров могут только менеджер или администратор.")
        if note.status != IssueNote.Status.AWAIT_CTRL_PICK:
            raise ValidationError("Назначение доступно после прихода товара (статус «Назначить контролёра»).")
        ser = AssignInspectionSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        ids = ser.validated_data["user_ids"]
        User = get_user_model()
        users = list(User.objects.filter(id__in=ids, is_active=True).select_related("role"))
        if len(users) != len(set(ids)):
            raise ValidationError("Указаны неизвестные или неактивные пользователи.")
        for u in users:
            if getattr(getattr(u, "role", None), "name", None) != Role.Name.WAREHOUSE_CONTROLLER:
                raise ValidationError("Можно выбирать только пользователей с ролью «Контролёр склада».")
        note.inspection_invited_users.set(users)
        note.status = IssueNote.Status.AWAITING_CONTROLLER
        note.save(update_fields=["status", "updated_at"])
        notify_goods_awaiting_controller(note, actor=request.user, recipients=users)
        return Response(_issue_note_data(note, request))

    @action(detail=True, methods=["post"], url_path="controller-complete")
    def controller_complete(self, request, pk=None):
        note = self.get_object()
        role_name = getattr(getattr(request.user, "role", None), "name", None)
        if not getattr(request.user, "is_superuser", False) and role_name not in (
            Role.Name.ADMIN,
            Role.Name.WAREHOUSE_CONTROLLER,
        ):
            raise PermissionDenied("Завершить приёмку может контролёр склада или администратор.")
        if note.status != IssueNote.Status.AWAITING_CONTROLLER:
            raise ValidationError("Приёмка доступна только в статусе «Ожидает приёмку».")
        if not _can_user_inspect(note, request.user):
            raise PermissionDenied("Вы не назначены на приёмку этой накладной.")

        raw_lines = request.data.get("lines")
        if isinstance(raw_lines, str):
            try:
                lines_payload = json.loads(raw_lines or "[]")
            except json.JSONDecodeError:
                raise ValidationError("Некорректный JSON в поле lines.")
        else:
            lines_payload = request.data.get("lines")
        ser = ControllerCompleteSerializer(data={"lines": lines_payload})
        ser.is_valid(raise_exception=True)
        lines = ser.validated_data["lines"]
        item_ids = {ln["item_id"] for ln in lines}
        db_items = {i.id: i for i in note.items.all()}
        if item_ids != set(db_items.keys()):
            raise ValidationError("Укажите факт по всем строкам накладной.")
        for ln in lines:
            item = db_items[ln["item_id"]]
            uploaded = _save_inspection_uploads(request, note.id, ln["item_id"])
            merged_photos = list(ln.get("inspection_photos") or []) + uploaded
            item.actual_quantity = ln["actual_quantity"]
            item.inspection_photos = merged_photos
            item.inspection_comment = (ln.get("inspection_comment") or "").strip()
            qty = ln["actual_quantity"]
            if qty > 0:
                cid = ln.get("cell_id")
                if cid:
                    cell = Cell.objects.get(pk=cid)
                else:
                    cell = (
                        Cell.objects.filter(
                            is_active=True,
                            rack__zone_id=ln["zone_id"],
                            rack__zone__warehouse_id=ln["warehouse_id"],
                        )
                        .order_by("id")
                        .first()
                    )
                    if not cell:
                        raise ValidationError(
                            "В выбранной зоне нет активных ячеек для оприходования. Добавьте ячейку в зоне или выберите другую зону."
                        )
                bal, _ = StockBalance.objects.get_or_create(
                    product=item.product, cell=cell, defaults={"quantity": 0}
                )
                bal.quantity += qty
                bal.save(update_fields=["quantity", "updated_at"])
                item.cell = cell
            else:
                item.cell = None
            item.save(
                update_fields=["actual_quantity", "inspection_photos", "inspection_comment", "cell", "updated_at"]
            )
        note.status = IssueNote.Status.WAREHOUSE_RECEIVED_CLOSED
        note.save(update_fields=["status", "updated_at"])
        notify_foreman_issue_note_warehouse_received(note, actor=request.user)
        return Response(_issue_note_data(note, request))

    def perform_create(self, serializer):
        role_name = getattr(getattr(self.request.user, "role", None), "name", None)
        request_obj = serializer.validated_data.get("request")
        construction_object = serializer.validated_data.get("construction_object")
        items_data = serializer.validated_data.pop("items")
        if role_name != Role.Name.FOREMAN:
            raise PermissionDenied("Создавать накладные может только прораб.")
        if not construction_object:
            raise ValidationError("Прораб должен выбрать закрепленный объект.")
        if not self.request.user.assigned_objects.filter(id=construction_object.id).exists():
            raise ValidationError("Прораб может отправлять накладные только по закрепленным объектам.")
        issued_note = serializer.save(
            number=f"TMP-{uuid4().hex[:10]}",
            created_by=self.request.user,
            status=IssueNote.Status.SUBMITTED,
            construction_object=construction_object or getattr(request_obj, "construction_object", None),
        )
        issued_note.number = f"IN-{issued_note.id:06d}"
        issued_note.save(update_fields=["number", "updated_at"])
        for raw_item in items_data:
            quantity = raw_item["quantity"]
            if quantity <= 0:
                raise ValidationError("Количество в накладной должно быть больше нуля.")
            request_item = raw_item.get("request_item")
            product = raw_item["product"]
            if request_item and request_obj and request_item.request_id != request_obj.id:
                raise ValidationError("Строка накладной не относится к выбранной заявке.")
            if request_item and product.id != request_item.product_id:
                raise ValidationError("Товар не совпадает со строкой заявки.")
            IssueNoteItem.objects.create(issue_note=issued_note, **raw_item)
        notify_issue_note_submitted(issued_note, actor=self.request.user)

    def perform_update(self, serializer):
        note = self.get_object()
        if note.status in (IssueNote.Status.WAREHOUSE_RECEIVED_CLOSED, IssueNote.Status.NOTE_COMPLETED):
            raise ValidationError("Накладная закрыта, изменение статуса невозможно.")
        role_name = getattr(getattr(self.request.user, "role", None), "name", None)
        vd = serializer.validated_data
        new_status = vd.get("status", note.status)

        if new_status == note.status:
            if not vd:
                serializer.save()
                return
            if role_name in (Role.Name.ADMIN, Role.Name.MANAGER):
                serializer.save()
                return
            raise PermissionDenied("Изменение полей без смены статуса доступно только менеджеру или администратору.")

        if new_status == IssueNote.Status.APPROVED:
            if role_name not in (Role.Name.ADMIN, Role.Name.MANAGER):
                raise PermissionDenied("Одобрять накладные могут только менеджер или администратор.")
            if note.status not in (IssueNote.Status.SUBMITTED, IssueNote.Status.AWAITING_RELEASE):
                raise ValidationError("Одобрение доступно на согласовании или после приёмки (ожидает выдачу со склада).")
            _deduct_stock_for_issue_note(note)
            updated = serializer.save(
                status=IssueNote.Status.APPROVED,
                approved_by=self.request.user,
                approved_at=timezone.now(),
            )
            notify_issue_note_decision(updated, actor=self.request.user, status="approved")
            notify_storekeepers_issue_note_approved_picking(updated, actor=self.request.user)
            return

        if new_status == IssueNote.Status.NOTE_COMPLETED:
            if note.status == IssueNote.Status.SUBMITTED:
                if role_name not in (Role.Name.ADMIN, Role.Name.MANAGER):
                    raise PermissionDenied("Отклонять накладные могут только менеджер или администратор.")
                rejection_comment = (vd.get("rejection_comment") or "").strip()
                if not rejection_comment:
                    raise ValidationError("Укажите причину отказа.")
                serializer.save(
                    status=IssueNote.Status.NOTE_COMPLETED,
                    rejection_comment=rejection_comment,
                    approved_by=self.request.user,
                    approved_at=timezone.now(),
                )
                notify_issue_note_decision(note, actor=self.request.user, status="rejected")
                return
            if note.status == IssueNote.Status.READY_PICKUP:
                if role_name != Role.Name.FOREMAN:
                    raise PermissionDenied("Подтвердить получение может только прораб.")
                if note.created_by_id != self.request.user.id:
                    raise PermissionDenied("Прораб может подтвердить только свою накладную.")
                serializer.save(status=IssueNote.Status.NOTE_COMPLETED)
                notify_issue_note_received_foreman(note, actor=self.request.user)
                return
            raise ValidationError("Завершить накладную в этом статусе нельзя.")

        if new_status == IssueNote.Status.PICKING:
            if not getattr(self.request.user, "is_superuser", False) and role_name not in (
                Role.Name.ADMIN,
                Role.Name.MANAGER,
                Role.Name.STOREKEEPER,
            ):
                raise PermissionDenied("Статус «Собирается» выставляют кладовщик, менеджер или администратор.")
            if note.status != IssueNote.Status.APPROVED:
                raise ValidationError("Сборка начинается после одобрения накладной.")
            serializer.save(status=IssueNote.Status.PICKING)
            return

        if new_status == IssueNote.Status.READY_PICKUP:
            if not getattr(self.request.user, "is_superuser", False) and role_name not in (
                Role.Name.ADMIN,
                Role.Name.MANAGER,
                Role.Name.STOREKEEPER,
            ):
                raise PermissionDenied("Статус «Готов к выдаче» выставляют кладовщик, менеджер или администратор.")
            if note.status != IssueNote.Status.PICKING:
                raise ValidationError("Сначала отметьте сборку (статус «Собирается»).")
            serializer.save(status=IssueNote.Status.READY_PICKUP)
            notify_issue_note_ready_pickup(note, actor=self.request.user)
            return

        raise ValidationError("Недопустимый переход статуса для PATCH.")
