from django.db import transaction

from .models import Membership, Workspace, allow_membership_writes


class LastOwnerViolation(ValueError):
    """Raised when an operation would leave a workspace without an owner."""


def create_workspace_with_owner(*, name: str, slug: str, owner) -> Workspace:
    """Create a tenant and its required first owner in one transaction."""
    with transaction.atomic():
        workspace = Workspace.objects.create(name=name, slug=slug)
        Membership.objects.create(
            workspace=workspace,
            user=owner,
            role=Membership.Role.OWNER,
        )
    return workspace


def change_membership_role(*, workspace_id: int, membership_id: int, role: str) -> Membership:
    """Change a membership role without allowing the last owner to be demoted."""
    new_role = _validated_role(role)

    with transaction.atomic():
        workspace = Workspace.objects.select_for_update().get(pk=workspace_id)
        membership = Membership.objects.select_for_update().get(
            pk=membership_id,
            workspace=workspace,
        )
        if membership.role == Membership.Role.OWNER and new_role != Membership.Role.OWNER:
            _ensure_workspace_keeps_owner(workspace)

        with allow_membership_writes():
            membership.role = new_role
            membership.save(update_fields=["role"])
    return membership


def remove_membership(*, workspace_id: int, membership_id: int) -> None:
    """Remove a membership without allowing the last owner to be removed."""
    with transaction.atomic():
        workspace = Workspace.objects.select_for_update().get(pk=workspace_id)
        membership = Membership.objects.select_for_update().get(
            pk=membership_id,
            workspace=workspace,
        )
        if membership.role == Membership.Role.OWNER:
            _ensure_workspace_keeps_owner(workspace)

        with allow_membership_writes():
            membership.delete()


def _validated_role(role: str) -> Membership.Role:
    try:
        return Membership.Role(role)
    except ValueError as error:
        raise ValueError("Invalid membership role.") from error


def _ensure_workspace_keeps_owner(workspace: Workspace) -> None:
    owners = list(
        Membership.objects.select_for_update()
        .filter(workspace=workspace, role=Membership.Role.OWNER)
        .only("pk")
    )
    if len(owners) <= 1:
        raise LastOwnerViolation("A workspace must retain at least one owner.")
