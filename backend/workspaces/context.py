"""Session-backed active workspace context resolution."""

from dataclasses import dataclass
from uuid import UUID

from django.core.exceptions import ValidationError
from django.http import HttpRequest

from .models import Membership, Workspace
from .permissions import (
    WorkspacePermissionDenied,
    can_resolve_workspace_context,
    require_workspace_permission,
)


ACTIVE_WORKSPACE_SESSION_KEY = "workspaces.active_workspace_public_id"


class WorkspaceContextError(PermissionError):
    """Base exception for invalid active workspace context."""


class NoActiveWorkspaceContext(WorkspaceContextError):
    """Raised when a request has not explicitly selected a workspace."""


class WorkspaceContextSelectionDenied(WorkspaceContextError):
    """Raised when a user attempts to select a workspace they do not belong to."""


class ActiveWorkspaceMembershipRequired(WorkspaceContextError):
    """Raised when the selected workspace membership is absent or revoked."""


class InactiveWorkspaceUser(WorkspaceContextError):
    """Raised when an inactive user attempts to use workspace context."""


@dataclass(frozen=True)
class ActiveWorkspaceContext:
    """The selected workspace and the user's current membership within it."""

    workspace: Workspace
    membership: Membership


def select_active_workspace(
    request: HttpRequest,
    public_id: UUID | str,
) -> ActiveWorkspaceContext:
    """Select one requesting-user workspace explicitly by public ID."""
    user = _active_user(request)
    workspace = _workspace_for_public_id(public_id)
    membership = _membership_for_user(workspace, user, selection=True)
    require_workspace_permission(membership, can_resolve_workspace_context)
    request.session[ACTIVE_WORKSPACE_SESSION_KEY] = str(workspace.public_id)
    return ActiveWorkspaceContext(workspace=workspace, membership=membership)


def resolve_active_workspace_context(request: HttpRequest) -> ActiveWorkspaceContext:
    """Resolve the active workspace only from the request session selection."""
    user = _active_user(request)
    public_id = request.session.get(ACTIVE_WORKSPACE_SESSION_KEY)
    if public_id is None:
        raise NoActiveWorkspaceContext(
            "An active workspace must be selected explicitly."
        )

    try:
        workspace = _workspace_for_public_id(public_id)
    except WorkspaceContextSelectionDenied as error:
        _clear_active_workspace(request)
        raise NoActiveWorkspaceContext("The selected workspace no longer exists.") from error

    try:
        membership = _membership_for_user(workspace, user, selection=False)
        require_workspace_permission(membership, can_resolve_workspace_context)
    except (WorkspaceContextError, WorkspacePermissionDenied):
        _clear_active_workspace(request)
        raise

    return ActiveWorkspaceContext(workspace=workspace, membership=membership)


def _active_user(request: HttpRequest):
    user = request.user
    if not getattr(user, "is_authenticated", False) or not user.is_active:
        _clear_active_workspace(request)
        raise InactiveWorkspaceUser(
            "An active authenticated user is required."
        )
    return user


def _workspace_for_public_id(public_id: UUID | str) -> Workspace:
    try:
        return Workspace.objects.get(public_id=public_id)
    except (TypeError, ValueError, ValidationError, Workspace.DoesNotExist) as error:
        raise WorkspaceContextSelectionDenied("Workspace selection is not available.") from error


def _membership_for_user(
    workspace: Workspace,
    user,
    *,
    selection: bool,
) -> Membership:
    try:
        return Membership.objects.select_related("workspace").get(
            workspace=workspace,
            user=user,
        )
    except Membership.DoesNotExist as error:
        exception = (
            WorkspaceContextSelectionDenied
            if selection
            else ActiveWorkspaceMembershipRequired
        )
        message = (
            "Workspace selection is not available."
            if selection
            else "Workspace membership is required."
        )
        raise exception(message) from error


def _clear_active_workspace(request: HttpRequest) -> None:
    request.session.pop(ACTIVE_WORKSPACE_SESSION_KEY, None)
