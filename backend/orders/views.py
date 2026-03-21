from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.exceptions import PermissionDenied, ValidationError
from django.utils import timezone
from rest_framework.response import Response
from uuid import uuid4
from users.mixins import SetAuditUserMixin
from users.models import Role
from users.permissions import AnyAuthenticatedRole, ManagerStorekeeper
from .models import Order, OrderItem, MaterialRequest, MaterialRequestItem, IssueNote, IssueNoteItem
from .serializers import (
    OrderSerializer,
    OrderCreateSerializer,
    OrderListSerializer,
    MaterialRequestSerializer,
    MaterialRequestCreateSerializer,
    MaterialRequestListSerializer,
    IssueNoteSerializer,
    IssueNoteCreateSerializer,
)
from stock.models import StockBalance
from notifications.services import notify_issue_note_submitted, notify_issue_note_decision


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
    queryset = IssueNote.objects.all().select_related("created_by", "request").prefetch_related("items__product", "items__cell")
    permission_classes = [AnyAuthenticatedRole]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ("request", "construction_object", "status", "created_at")
    search_fields = ("number", "recipient_name", "request__object_name", "construction_object__name", "created_by__username")
    ordering_fields = ("id", "created_at", "number", "status")
    ordering = ("-created_at",)

    def get_queryset(self):
        qs = super().get_queryset().select_related("construction_object", "approved_by")
        role_name = getattr(getattr(self.request.user, "role", None), "name", None)
        if role_name == Role.Name.FOREMAN:
            return qs.filter(created_by=self.request.user)
        return qs

    def get_serializer_class(self):
        if self.action == "create":
            return IssueNoteCreateSerializer
        return IssueNoteSerializer

    @action(detail=False, methods=["get"], url_path="next-number")
    def next_number(self, request):
        next_id = (IssueNote.objects.order_by("-id").values_list("id", flat=True).first() or 0) + 1
        return Response({"number": f"IN-{next_id:06d}"})

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
        role_name = getattr(getattr(self.request.user, "role", None), "name", None)
        new_status = serializer.validated_data.get("status", note.status)
        if new_status == note.status:
            serializer.save()
            return
        if role_name not in (Role.Name.ADMIN, Role.Name.MANAGER):
            raise PermissionDenied("Одобрять/отклонять накладные могут только менеджер или администратор.")
        if note.status != IssueNote.Status.SUBMITTED:
            raise ValidationError("Изменить статус можно только для накладной на согласовании.")
        if new_status == IssueNote.Status.APPROVED:
            for item in note.items.select_related("product", "request_item", "cell"):
                quantity = item.quantity
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
            serializer.save(status=IssueNote.Status.APPROVED, approved_by=self.request.user, approved_at=timezone.now())
            notify_issue_note_decision(note, actor=self.request.user, status="approved")
            return
        if new_status == IssueNote.Status.REJECTED:
            rejection_comment = (serializer.validated_data.get("rejection_comment") or "").strip()
            if not rejection_comment:
                raise ValidationError("Укажите причину отказа.")
            serializer.save(
                status=IssueNote.Status.REJECTED,
                rejection_comment=rejection_comment,
                approved_by=self.request.user,
                approved_at=timezone.now(),
            )
            notify_issue_note_decision(note, actor=self.request.user, status="rejected")
            return
        raise ValidationError("Допустимые статусы согласования: approved или rejected.")
