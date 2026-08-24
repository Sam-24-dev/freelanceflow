"""Authorized append facade for audit facts emitted by domain services."""

from .models import AuditEvent, audit_event_write_boundary


def record_audit_event(
    *,
    workspace,
    actor,
    event_type,
    target_membership_id,
    role_before,
    role_after,
):
    """Append one validated audit event through the internal write boundary."""
    with audit_event_write_boundary():
        return AuditEvent.objects.create(
            workspace=workspace,
            actor=actor,
            event_type=event_type,
            target_membership_id=target_membership_id,
            role_before=role_before,
            role_after=role_after,
        )
