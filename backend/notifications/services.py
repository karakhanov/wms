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
