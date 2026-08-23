from decimal import Decimal
from uuid import UUID

from django.core.exceptions import ValidationError
from django.db import transaction

from workspaces.context import ActiveWorkspaceContext
from workspaces.models import Membership, Workspace
from workspaces.permissions import can_perform_operational_work

from .models import Category


_UNSET = object()


class CategoryAccessDenied(PermissionError):
    """Raised when the active workspace cannot perform category work."""


def _authorize(context: ActiveWorkspaceContext) -> Workspace:
    if not isinstance(context, ActiveWorkspaceContext):
        raise CategoryAccessDenied("An active workspace context is required.")
    try:
        membership = Membership.objects.get(pk=context.membership.pk, workspace=context.workspace)
    except Membership.DoesNotExist as error:
        raise CategoryAccessDenied("Active workspace membership is required.") from error
    if not can_perform_operational_work(membership):
        raise CategoryAccessDenied("Category access requires an owner or operational membership.")
    return context.workspace


def create_category(
    context: ActiveWorkspaceContext,
    *,
    name: str,
    description: str = "",
    default_deductible: bool = False,
    monthly_budget: Decimal | None | object = _UNSET,
    status: str = Category.Status.ACTIVE,
    workspace: Workspace | None = None,
) -> Category:
    """Create a category only within the caller's active workspace."""
    active_workspace = _authorize(context)
    if workspace is not None and workspace.pk != active_workspace.pk:
        raise CategoryAccessDenied("Category workspace must be the active workspace.")
    with transaction.atomic():
        return Category.objects.create(
            workspace=active_workspace,
            name=name,
            description=description,
            default_deductible=default_deductible,
            monthly_budget=None if monthly_budget is _UNSET else monthly_budget,
            status=status,
        )


def get_categories_for_workspace(context: ActiveWorkspaceContext, *, selectable_only: bool = False):
    """Return only categories belonging to the authorized active workspace."""
    workspace = _authorize(context)
    categories = Category.objects.for_workspace(workspace)
    return categories.selectable() if selectable_only else categories


def get_category_by_public_id(
    context: ActiveWorkspaceContext,
    public_id: UUID | str,
    *,
    selectable_only: bool = False,
) -> Category:
    """Look up a category by public ID without crossing the tenant boundary."""
    categories = get_categories_for_workspace(context, selectable_only=selectable_only)
    try:
        return categories.get(public_id=public_id)
    except (Category.DoesNotExist, ValueError, ValidationError) as error:
        raise CategoryAccessDenied("Category is not available in the active workspace.") from error


def update_category(
    context: ActiveWorkspaceContext,
    category: Category,
    *,
    name: str | None = None,
    description: str | None = None,
    default_deductible: bool | None = None,
    monthly_budget: Decimal | None | object = _UNSET,
    status: str | None = None,
) -> Category:
    """Update a category through a context-scoped, tenant-safe service."""
    workspace = _authorize(context)
    if category.workspace_id != workspace.pk:
        raise CategoryAccessDenied("Category is not available in the active workspace.")
    with transaction.atomic():
        try:
            persisted = Category.objects.for_workspace(workspace).select_for_update().get(pk=category.pk)
        except Category.DoesNotExist as error:
            raise CategoryAccessDenied("Category is not available in the active workspace.") from error
        if name is not None:
            persisted.name = name
        if description is not None:
            persisted.description = description
        if default_deductible is not None:
            persisted.default_deductible = default_deductible
        if monthly_budget is not _UNSET:
            persisted.monthly_budget = monthly_budget
        if status is not None:
            persisted.status = status
        persisted.save()
        return persisted
