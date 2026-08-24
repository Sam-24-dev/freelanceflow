from django.db import IntegrityError, transaction

from workspaces.context import ActiveWorkspaceContext
from workspaces.models import Membership
from workspaces.permissions import can_resolve_workspace_context, require_workspace_permission

from .models import MembershipInterfacePreference, allow_interface_preference_writes


class InterfacePreferenceAccessDenied(PermissionError):
    """Raised when an interface preference request lacks active membership context."""


def get_interface_preferences(context: ActiveWorkspaceContext) -> MembershipInterfacePreference:
    """Return the caller's current membership-owned interface preferences."""
    with transaction.atomic():
        return _materialize_preferences(_authorize_context(context))


def update_interface_preferences(
    context: ActiveWorkspaceContext,
    sidebar_collapsed: bool,
) -> MembershipInterfacePreference:
    """Persist the caller's sidebar state only when it is a real boolean."""
    if type(sidebar_collapsed) is not bool:
        raise TypeError("sidebar_collapsed must be a bool.")
    with transaction.atomic():
        preference = _materialize_preferences(_authorize_context(context))
        preference.sidebar_collapsed = sidebar_collapsed
        with allow_interface_preference_writes():
            preference.save(update_fields=["sidebar_collapsed", "updated_at"])
        return preference


def _authorize_context(context: ActiveWorkspaceContext) -> Membership:
    """Lock and re-fetch the current active membership in the selected workspace."""
    if not isinstance(context, ActiveWorkspaceContext):
        raise InterfacePreferenceAccessDenied("An active workspace context is required.")
    try:
        membership_id = context.membership.pk
        workspace_id = context.workspace.pk
    except AttributeError as error:
        raise InterfacePreferenceAccessDenied("An active workspace context is required.") from error
    if membership_id is None or workspace_id is None:
        raise InterfacePreferenceAccessDenied("An active workspace context is required.")
    try:
        membership = Membership.objects.select_for_update().select_related("user").get(
            pk=membership_id,
            workspace_id=workspace_id,
        )
    except (Membership.DoesNotExist, TypeError, ValueError) as error:
        raise InterfacePreferenceAccessDenied("Active workspace membership is required.") from error
    if not membership.user.is_active:
        raise InterfacePreferenceAccessDenied("Active workspace membership is required.")
    try:
        require_workspace_permission(membership, can_resolve_workspace_context)
    except PermissionError as error:
        raise InterfacePreferenceAccessDenied("Active workspace membership is required.") from error
    return membership


def _materialize_preferences(membership: Membership) -> MembershipInterfacePreference:
    """Create one default profile while tolerating a simultaneous first request."""
    try:
        with transaction.atomic():
            with allow_interface_preference_writes():
                preference, _ = MembershipInterfacePreference.objects.get_or_create(
                    owner=membership,
                )
            return preference
    except IntegrityError:
        try:
            return MembershipInterfacePreference.objects.get(owner=membership)
        except MembershipInterfacePreference.DoesNotExist as error:
            raise InterfacePreferenceAccessDenied(
                "Active workspace membership is required."
            ) from error
