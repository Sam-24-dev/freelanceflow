from decimal import Decimal

from django.db import transaction

from workspaces.context import ActiveWorkspaceContext
from workspaces.models import Membership, Workspace
from workspaces.permissions import can_perform_operational_work

from .models import FiscalConfiguration, _fiscal_service_write_boundary


class FiscalAccessDenied(PermissionError):
    """Raised when a caller lacks Fiscal Configuration business access."""


class FiscalConfigurationNotConfigured(LookupError):
    """Raised when an authorized workspace has no fiscal configuration."""


def _authorize(context: ActiveWorkspaceContext) -> Workspace:
    try:
        membership = Membership.objects.get(pk=context.membership.pk, workspace=context.workspace)
    except Membership.DoesNotExist as error:
        raise FiscalAccessDenied("Active workspace membership is required.") from error
    if not can_perform_operational_work(membership):
        raise FiscalAccessDenied("Fiscal configuration access requires an owner or operational membership.")
    return context.workspace


def create_fiscal_configuration(
    context: ActiveWorkspaceContext,
    *,
    legal_name: str,
    tax_identifier: str,
    tax_regime: str,
    applies_vat: bool,
    vat_rate: Decimal,
    withholding_rate: Decimal,
    workspace: Workspace | None = None,
) -> FiscalConfiguration:
    """Create the next immediately-current immutable fiscal configuration."""
    active_workspace = _authorize(context)
    if workspace is not None and workspace.pk != active_workspace.pk:
        raise FiscalAccessDenied("Fiscal configuration workspace must be the active workspace.")
    with transaction.atomic():
        # Locking the tenant row serializes version allocation even when it has
        # no prior FiscalConfiguration rows.
        locked_workspace = Workspace.objects.select_for_update().get(pk=active_workspace.pk)
        latest = (
            FiscalConfiguration.objects.for_workspace(locked_workspace)
            .order_by("-version")
            .values_list("version", flat=True)
            .first()
        )
        with _fiscal_service_write_boundary():
            return FiscalConfiguration.objects.create(
                workspace=locked_workspace,
                version=(latest or 0) + 1,
                legal_name=legal_name,
                tax_identifier=tax_identifier,
                tax_regime=tax_regime,
                applies_vat=applies_vat,
                vat_rate=vat_rate,
                withholding_rate=withholding_rate,
            )


def get_current_fiscal_configuration(context: ActiveWorkspaceContext) -> FiscalConfiguration:
    """Return the most recent immediately-effective fiscal configuration."""
    workspace = _authorize(context)
    try:
        return FiscalConfiguration.objects.for_workspace(workspace).latest("version")
    except FiscalConfiguration.DoesNotExist as error:
        raise FiscalConfigurationNotConfigured(
            "No fiscal configuration exists in the active workspace."
        ) from error
