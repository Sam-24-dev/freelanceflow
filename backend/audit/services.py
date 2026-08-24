"""Authorized audit event read and append facades."""

from django.core.exceptions import ValidationError

from workspaces.context import ActiveWorkspaceContext
from workspaces.models import Membership, Workspace
from workspaces.permissions import can_read_audit_events

from .models import AuditEvent, AuditEventQuerySet, audit_event_write_boundary


class AuditEventAccessDenied(PermissionError):
    """Raised when the active workspace cannot read audit events."""


def _authorize_audit_read(context: ActiveWorkspaceContext) -> Workspace:
    """Re-fetch an active administrative membership for the supplied context."""
    if not isinstance(context, ActiveWorkspaceContext):
        raise AuditEventAccessDenied("An active workspace context is required.")
    try:
        membership = Membership.objects.select_related("user").get(
            pk=context.membership.pk,
            workspace=context.workspace,
        )
    except (
        AttributeError,
        Membership.DoesNotExist,
        TypeError,
        ValueError,
        ValidationError,
    ) as error:
        raise AuditEventAccessDenied("Active workspace membership is required.") from error
    if not membership.user.is_active or not can_read_audit_events(membership):
        raise AuditEventAccessDenied(
            "Audit event access requires an active administrative membership."
        )
    return context.workspace


def list_audit_events(context: ActiveWorkspaceContext) -> AuditEventQuerySet:
    """Return the authorized workspace's audit events in deterministic newest-first order."""
    workspace = _authorize_audit_read(context)
    return (
        AuditEvent.objects.for_workspace(workspace)
        .select_related("actor")
        .order_by("-created_at", "-pk")
    )


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
