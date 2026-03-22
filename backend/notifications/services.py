from users.models import Role, User

from .models import Notification


def _create_notifications(recipients, payload, actor=None):
    for user in recipients:
        Notification.objects.create(
            recipient=user,
            created_by=actor,
            updated_by=actor,
            **payload,
        )


def notify_issue_note_submitted(note, actor=None):
    recipients = User.objects.filter(
        is_active=True,
        role__name__in=(Role.Name.ADMIN, Role.Name.MANAGER),
    ).exclude(id=getattr(actor, "id", None))
    object_name = getattr(getattr(note, "construction_object", None), "name", "") or "-"
    payload = {
        "type": Notification.Type.ISSUE_NOTE_SUBMITTED,
        "title": f"Новая накладная {note.number}",
        "message": f"Накладная {note.number} по объекту {object_name} ожидает согласования.",
        "payload": {
            "number": note.number,
            "object_name": object_name,
        },
        "entity_type": "issue_note",
        "entity_id": note.id,
    }
    _create_notifications(recipients, payload, actor=actor)


def notify_issue_note_decision(note, actor=None, status=""):
    recipient = getattr(note, "created_by", None)
    if not recipient or not recipient.is_active:
        return
    decision = Notification.Type.ISSUE_NOTE_APPROVED if status == "approved" else Notification.Type.ISSUE_NOTE_REJECTED
    title = "Накладная одобрена" if status == "approved" else "Накладная отклонена"
    payload = {
        "type": decision,
        "title": f"{title}: {note.number}",
        "message": f"Статус накладной {note.number} изменен на: {title.lower()}.",
        "payload": {
            "number": note.number,
        },
        "entity_type": "issue_note",
        "entity_id": note.id,
    }
    _create_notifications([recipient], payload, actor=actor)


def _object_name(note):
    return getattr(getattr(note, "construction_object", None), "name", "") or "-"


def notify_issue_note_sent_procurement(note, actor=None):
    recipients = User.objects.filter(is_active=True, role__name=Role.Name.PROCUREMENT).exclude(
        id=getattr(actor, "id", None)
    )
    payload = {
        "type": Notification.Type.ISSUE_NOTE_SENT_PROCUREMENT,
        "title": f"Накладная у снабжения: {note.number}",
        "message": f"Накладная {note.number} ({_object_name(note)}) передана в снабжение.",
        "payload": {"number": note.number},
        "entity_type": "issue_note",
        "entity_id": note.id,
    }
    _create_notifications(recipients, payload, actor=actor)


def notify_procurement_declined(note, actor=None):
    recipient = getattr(note, "created_by", None)
    if not recipient or not recipient.is_active:
        return
    payload = {
        "type": Notification.Type.ISSUE_NOTE_PROCUREMENT_DECLINED,
        "title": f"Снабжение отказало: {note.number}",
        "message": f"По накладной {note.number} снабжение не может обеспечить закупку.",
        "payload": {"number": note.number},
        "entity_type": "issue_note",
        "entity_id": note.id,
    }
    _create_notifications([recipient], payload, actor=actor)


def notify_goods_awaiting_controller(note, actor=None, recipients=None):
    if recipients is None:
        qs = User.objects.filter(is_active=True, role__name=Role.Name.WAREHOUSE_CONTROLLER).exclude(
            id=getattr(actor, "id", None)
        )
        recipients = list(qs)
    else:
        recipients = [u for u in recipients if getattr(u, "is_active", False) and u.id != getattr(actor, "id", None)]
    if not recipients:
        return
    payload = {
        "type": Notification.Type.ISSUE_NOTE_GOODS_FOR_INSPECTION,
        "title": f"Приёмка: {note.number}",
        "message": f"Товар по накладной {note.number} ожидает проверку контролёра.",
        "payload": {"number": note.number},
        "entity_type": "issue_note",
        "entity_id": note.id,
    }
    _create_notifications(recipients, payload, actor=actor)


def notify_managers_assign_controllers(note, actor=None):
    recipients = list(
        User.objects.filter(is_active=True, role__name__in=(Role.Name.ADMIN, Role.Name.MANAGER)).exclude(
            id=getattr(actor, "id", None)
        )
    )
    if not recipients:
        return
    payload = {
        "type": Notification.Type.ISSUE_NOTE_ASSIGN_CONTROLLERS,
        "title": f"Назначьте контролёров: {note.number}",
        "message": f"Товар по накладной {note.number} прибыл. Выберите контролёров для приёмки.",
        "payload": {"number": note.number},
        "entity_type": "issue_note",
        "entity_id": note.id,
    }
    _create_notifications(recipients, payload, actor=actor)


def notify_inspection_done(note, actor=None):
    recipients = User.objects.filter(
        is_active=True,
        role__name__in=(Role.Name.ADMIN, Role.Name.MANAGER),
    ).exclude(id=getattr(actor, "id", None))
    payload = {
        "type": Notification.Type.ISSUE_NOTE_INSPECTION_DONE,
        "title": f"Приёмка завершена: {note.number}",
        "message": f"Контролёр завершил приёмку по накладной {note.number}. Требуется одобрение выдачи.",
        "payload": {"number": note.number},
        "entity_type": "issue_note",
        "entity_id": note.id,
    }
    _create_notifications(recipients, payload, actor=actor)


def notify_issue_note_ready_pickup(note, actor=None):
    recipient = getattr(note, "created_by", None)
    if not recipient or not recipient.is_active:
        return
    payload = {
        "type": Notification.Type.ISSUE_NOTE_READY_PICKUP,
        "title": f"Готово к выдаче: {note.number}",
        "message": f"Накладная {note.number} собрана, можно забирать материалы.",
        "payload": {"number": note.number},
        "entity_type": "issue_note",
        "entity_id": note.id,
    }
    _create_notifications([recipient], payload, actor=actor)


def notify_issue_note_received_foreman(note, actor=None):
    recipients = User.objects.filter(
        is_active=True,
        role__name__in=(Role.Name.ADMIN, Role.Name.MANAGER, Role.Name.STOREKEEPER),
    ).exclude(id=getattr(actor, "id", None))
    payload = {
        "type": Notification.Type.ISSUE_NOTE_RECEIVED_FOREMAN,
        "title": f"Прораб получил: {note.number}",
        "message": f"По накладной {note.number} прораб подтвердил получение.",
        "payload": {"number": note.number},
        "entity_type": "issue_note",
        "entity_id": note.id,
    }
    _create_notifications(recipients, payload, actor=actor)
