from django.db import transaction

from audit.models import AuditEvent
from audit.services import record_audit_event

from .models import Membership, Workspace, allow_membership_writes
from .permissions import (
    WorkspacePermissionDenied,
    can_manage_workspace_memberships,
    require_workspace_permission,
)


class LastOwnerViolation(ValueError):
    """Raised when an operation would leave a workspace without an owner."""


def create_workspace_with_owner(*, name: str, slug: str, owner) -> Workspace:
    """Create a tenant, its first owner, and its creation fact atomically."""
    with transaction.atomic():
        workspace = Workspace.objects.create(name=name, slug=slug)
        membership = Membership.objects.create(
            workspace=workspace,
            user=owner,
            role=Membership.Role.OWNER,
        )
        actor_membership = _require_active_owner(workspace=workspace, actor=owner)
        record_audit_event(
            workspace=workspace,
            actor=actor_membership.user,
            event_type=AuditEvent.EventType.WORKSPACE_CREATED,
            target_membership_id=membership.pk,
            role_before=None,
            role_after=Membership.Role.OWNER,
        )
    return workspace


def change_membership_role(*, workspace_id: int, membership_id: int, role: str, actor) -> Membership:
    """Change a role as a current active owner and retain its audit fact."""
    new_role = _validated_role(role)

    with transaction.atomic():
        workspace = Workspace.objects.select_for_update().get(pk=workspace_id)
        actor_membership = _require_active_owner(workspace=workspace, actor=actor)
        membership = Membership.objects.select_for_update().get(
            pk=membership_id,
            workspace=workspace,
        )
        previous_role = membership.role
        if previous_role == new_role:
            return membership
        if previous_role == Membership.Role.OWNER and new_role != Membership.Role.OWNER:
            _ensure_workspace_keeps_owner(workspace)

        with allow_membership_writes():
            membership.role = new_role
            membership.save(update_fields=["role"])
        record_audit_event(
            workspace=workspace,
            actor=actor_membership.user,
            event_type=AuditEvent.EventType.MEMBERSHIP_ROLE_CHANGED,
            target_membership_id=membership.pk,
            role_before=previous_role,
            role_after=new_role,
        )
    return membership


def remove_membership(*, workspace_id: int, membership_id: int, actor) -> None:
    """Remove a membership and retain the fact before deletion atomically."""
    with transaction.atomic():
        workspace = Workspace.objects.select_for_update().get(pk=workspace_id)
        actor_membership = _require_active_owner(workspace=workspace, actor=actor)
        membership = Membership.objects.select_for_update().get(
            pk=membership_id,
            workspace=workspace,
        )
        previous_role = membership.role
        target_membership_id = membership.pk
        if previous_role == Membership.Role.OWNER:
            _ensure_workspace_keeps_owner(workspace)

        record_audit_event(
            workspace=workspace,
            actor=actor_membership.user,
            event_type=AuditEvent.EventType.MEMBERSHIP_REMOVED,
            target_membership_id=target_membership_id,
            role_before=previous_role,
            role_after=None,
        )
        with allow_membership_writes():
            membership.delete()


def _validated_role(role: str) -> Membership.Role:
    try:
        return Membership.Role(role)
    except ValueError as error:
        raise ValueError("Invalid membership role.") from error


def _require_active_owner(*, workspace: Workspace, actor) -> Membership:
    """Re-fetch an active owner membership; flags never bypass tenant scope."""
    try:
        membership = Membership.objects.select_for_update().select_related("user").get(
            workspace=workspace,
            user=actor,
        )
    except Membership.DoesNotExist as error:
        raise WorkspacePermissionDenied(
            "Workspace membership management requires an active owner membership."
        ) from error
    if not membership.user.is_active:
        raise WorkspacePermissionDenied(
            "Workspace membership management requires an active owner membership."
        )
    require_workspace_permission(membership, can_manage_workspace_memberships)
    return membership


def _ensure_workspace_keeps_owner(workspace: Workspace) -> None:
    owners = list(
        Membership.objects.select_for_update()
        .filter(workspace=workspace, role=Membership.Role.OWNER)
        .only("pk")
    )
    if len(owners) <= 1:
        raise LastOwnerViolation("A workspace must retain at least one owner.")
