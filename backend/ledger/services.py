"""Tenant-scoped, idempotent Ledger manual-entry services."""

from uuid import UUID

from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction

from categories.models import Category
from clients.models import Client
from projects.models import Project
from workspaces.context import ActiveWorkspaceContext
from workspaces.models import Membership, Workspace
from workspaces.permissions import can_perform_operational_work

from .models import LedgerEntry, _ledger_service_write_boundary, calculate_request_fingerprint


class LedgerAccessDenied(PermissionError):
    """Raised when a Ledger resource is unavailable in the active workspace."""


class LedgerIdempotencyConflict(ValueError):
    """Raised when an idempotency key is reused for another request."""


class LedgerValidationError(ValueError):
    """Raised when a manual-entry request cannot be represented safely."""


def _authorize(context: ActiveWorkspaceContext) -> tuple[Workspace, object]:
    if not isinstance(context, ActiveWorkspaceContext):
        raise LedgerAccessDenied("An active workspace context is required.")
    try:
        membership = Membership.objects.select_related("user").get(
            pk=context.membership.pk,
            workspace=context.workspace,
        )
    except (Membership.DoesNotExist, TypeError, ValueError, ValidationError) as error:
        raise LedgerAccessDenied("Active workspace membership is required.") from error
    if not membership.user.is_active or not can_perform_operational_work(membership):
        raise LedgerAccessDenied("Ledger access requires an active owner or operational membership.")
    return context.workspace, membership.user


def _locked_in_workspace(model, workspace: Workspace, value, label: str):
    if not isinstance(value, model) or value.pk is None:
        raise LedgerAccessDenied(f"{label} is not available in the active workspace.")
    try:
        return model.objects.for_workspace(workspace).select_for_update().get(pk=value.pk)
    except model.DoesNotExist as error:
        raise LedgerAccessDenied(f"{label} is not available in the active workspace.") from error


def _idempotency_key(value) -> UUID:
    try:
        return value if isinstance(value, UUID) else UUID(str(value))
    except (TypeError, ValueError, AttributeError) as error:
        raise LedgerValidationError("A valid idempotency key is required.") from error


def _entry_for_key(workspace: Workspace, key: UUID):
    return LedgerEntry.objects.for_workspace(workspace).select_for_update().filter(
        idempotency_key=key
    ).first()


def _replay_or_conflict(entry: LedgerEntry, request_fingerprint: str) -> LedgerEntry:
    if entry.request_fingerprint == request_fingerprint:
        return entry
    raise LedgerIdempotencyConflict("Idempotency key was already used for a different Ledger request.")


def get_ledger_entries(context: ActiveWorkspaceContext):
    """Return Ledger entries visible to the current authorized workspace only."""
    workspace, _ = _authorize(context)
    return LedgerEntry.objects.for_workspace(workspace)


def get_ledger_entry_by_public_id(context: ActiveWorkspaceContext, public_id: UUID | str) -> LedgerEntry:
    """Look up one Ledger entry without leaking another workspace's entry."""
    try:
        return get_ledger_entries(context).get(public_id=public_id)
    except (LedgerEntry.DoesNotExist, TypeError, ValueError, ValidationError) as error:
        raise LedgerAccessDenied("Ledger entry is not available in the active workspace.") from error


def record_manual_entry(
    context: ActiveWorkspaceContext,
    *,
    idempotency_key: UUID | str,
    direction: str,
    amount,
    occurred_on,
    description: str,
    category: Category | None = None,
    client: Client | None = None,
    project: Project | None = None,
) -> LedgerEntry:
    """Append one MANUAL entry or return its exact semantic idempotent replay."""
    workspace, created_by = _authorize(context)
    key = _idempotency_key(idempotency_key)
    if direction not in LedgerEntry.Direction.values:
        raise LedgerValidationError("Ledger direction is invalid.")
    if not isinstance(description, str):
        raise LedgerValidationError("Ledger description is invalid.")

    with transaction.atomic():
        locked_category = None
        if direction == LedgerEntry.Direction.EXPENSE:
            locked_category = _locked_in_workspace(Category, workspace, category, "Category")
            if locked_category.status != Category.Status.ACTIVE:
                raise LedgerAccessDenied("Category is not available in the active workspace.")
        elif category is not None:
            raise LedgerAccessDenied("Income entries cannot carry a category.")

        locked_client = None if client is None else _locked_in_workspace(Client, workspace, client, "Client")
        locked_project = None if project is None else _locked_in_workspace(Project, workspace, project, "Project")
        if locked_project is not None and (locked_client is None or locked_project.client_id != locked_client.pk):
            raise LedgerAccessDenied("Project is not available for the active workspace client.")

        request_fingerprint = calculate_request_fingerprint(
            workspace_id=workspace.pk,
            direction=direction,
            source=LedgerEntry.Source.MANUAL,
            amount=amount,
            currency="USD",
            occurred_on=occurred_on,
            description=description,
            category_id=None if locked_category is None else locked_category.pk,
            client_id=None if locked_client is None else locked_client.pk,
            project_id=None if locked_project is None else locked_project.pk,
        )
        existing = _entry_for_key(workspace, key)
        if existing is not None:
            return _replay_or_conflict(existing, request_fingerprint)

        entry = LedgerEntry(
            workspace=workspace,
            idempotency_key=key,
            request_fingerprint=request_fingerprint,
            direction=direction,
            source=LedgerEntry.Source.MANUAL,
            amount=amount,
            currency="USD",
            occurred_on=occurred_on,
            description=description,
            category=locked_category,
            category_name_snapshot="" if locked_category is None else locked_category.name,
            category_deductible_snapshot=None if locked_category is None else locked_category.default_deductible,
            client=locked_client,
            project=locked_project,
            created_by=created_by,
        )
        try:
            with transaction.atomic(), _ledger_service_write_boundary():
                entry.save()
        except IntegrityError:
            existing = _entry_for_key(workspace, key)
            if existing is None:
                raise
            return _replay_or_conflict(existing, request_fingerprint)
        return entry
