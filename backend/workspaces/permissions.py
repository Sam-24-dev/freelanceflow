"""Pure membership capability checks for workspace-scoped operations."""

from collections.abc import Callable

from .models import Membership


class WorkspacePermissionDenied(PermissionError):
    """Raised when a membership lacks a required workspace capability."""


MembershipPermission = Callable[[Membership], bool]


def can_resolve_workspace_context(membership: Membership) -> bool:
    """Return whether a membership may identify its selected workspace."""
    return membership.role in Membership.Role.values


def can_manage_workspace_memberships(membership: Membership) -> bool:
    """Return whether a membership may manage tenant membership."""
    return membership.role == Membership.Role.OWNER


def can_read_audit_events(membership: Membership) -> bool:
    """Return whether a membership has the administrative audit-read role."""
    return membership.role == Membership.Role.ADMINISTRATIVE


def can_perform_operational_work(membership: Membership) -> bool:
    """Return whether a membership may perform future operational business work."""
    return membership.role in (Membership.Role.OWNER, Membership.Role.OPERATIONAL)


def require_workspace_permission(
    membership: Membership,
    permission: MembershipPermission,
) -> None:
    """Raise when a pure membership permission predicate does not allow access."""
    if not permission(membership):
        raise WorkspacePermissionDenied("Workspace membership lacks this permission.")
