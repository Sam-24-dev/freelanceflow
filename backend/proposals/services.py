from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from clients.models import Client
from services.models import Service
from workspaces.context import ActiveWorkspaceContext
from workspaces.models import Membership, Workspace
from workspaces.permissions import can_perform_operational_work

from .models import Proposal, ProposalLineItem, _proposal_service_write_boundary


class ProposalAccessDenied(PermissionError):
    """Raised when a caller lacks access to Proposal business operations."""


class ProposalTransitionError(ValueError):
    """Raised when a Proposal lifecycle or write rule is violated."""


def _authorize(context: ActiveWorkspaceContext) -> Workspace:
    """Authorize a resolved active-workspace context for Proposal operations."""
    try:
        membership = Membership.objects.get(
            pk=context.membership.pk,
            workspace=context.workspace,
        )
    except Membership.DoesNotExist as error:
        raise ProposalAccessDenied("Active workspace membership is required.") from error
    if not can_perform_operational_work(membership):
        raise ProposalAccessDenied("Proposal access requires an owner or operational membership.")
    return context.workspace


def _proposal_for_workspace(workspace: Workspace, proposal: Proposal, *, lock=False) -> Proposal:
    queryset = Proposal.objects.for_workspace(workspace)
    if lock:
        queryset = queryset.select_for_update()
    try:
        return queryset.get(pk=proposal.pk)
    except Proposal.DoesNotExist as error:
        raise ProposalAccessDenied("Proposal is not available in the active workspace.") from error


def create_proposal(context: ActiveWorkspaceContext, client: Client, title: str, issued_on, valid_until, notes="") -> Proposal:
    workspace = _authorize(context)
    if client.workspace_id != workspace.pk:
        raise ProposalAccessDenied("Client is not available in the active workspace.")
    return Proposal.objects.create(workspace=workspace, client=client, title=title, notes=notes, issued_on=issued_on, valid_until=valid_until)


def get_proposals_for_workspace(context: ActiveWorkspaceContext):
    workspace = _authorize(context)
    return Proposal.objects.for_workspace(workspace)


def add_line_item(context: ActiveWorkspaceContext, proposal: Proposal, *, position: int, service_name=None, unit_of_measure=None, quantity: Decimal, unit_rate=None, description="", source_service=None) -> ProposalLineItem:
    workspace = _authorize(context)
    with transaction.atomic():
        proposal = _proposal_for_workspace(workspace, proposal, lock=True)
        if proposal.status != Proposal.Status.DRAFT:
            raise ProposalTransitionError("Proposal lines are immutable after sending.")
        if source_service is not None:
            try:
                source_service = Service.objects.for_workspace(workspace).get(pk=source_service.pk)
            except Service.DoesNotExist as error:
                raise ProposalAccessDenied("Service is not available in the active workspace.") from error
            service_name = source_service.name
            unit_of_measure = source_service.unit_of_measure
            unit_rate = source_service.rate
            currency = source_service.currency
        else:
            currency = ProposalLineItem.Currency.USD
        with _proposal_service_write_boundary():
            return ProposalLineItem.objects.create(
                proposal=proposal, position=position, source_service=source_service,
                service_name=service_name, unit_of_measure=unit_of_measure, quantity=quantity,
                unit_rate=unit_rate, currency=currency, description=description,
            )


def send_proposal(context: ActiveWorkspaceContext, proposal: Proposal) -> Proposal:
    workspace = _authorize(context)
    with transaction.atomic():
        proposal = _proposal_for_workspace(workspace, proposal, lock=True)
        if proposal.status != Proposal.Status.DRAFT:
            raise ProposalTransitionError("Only drafts can be sent.")
        if not proposal.line_items.exists():
            raise ProposalTransitionError("A proposal requires at least one line item before sending.")
        proposal.status = Proposal.Status.SENT
        proposal.sent_at = timezone.now()
        with _proposal_service_write_boundary():
            proposal.save(update_fields=["status", "sent_at", "updated_at"])
    return proposal


def transition_proposal(context: ActiveWorkspaceContext, proposal: Proposal, target_status: str) -> Proposal:
    workspace = _authorize(context)
    transitions = {
        Proposal.Status.SENT: {Proposal.Status.ACCEPTED: "accepted_at", Proposal.Status.REJECTED: "rejected_at", Proposal.Status.EXPIRED: "expired_at"},
        Proposal.Status.ACCEPTED: {Proposal.Status.CONVERTED: "converted_at"},
    }
    with transaction.atomic():
        proposal = _proposal_for_workspace(workspace, proposal, lock=True)
        allowed = transitions.get(proposal.status, {})
        timestamp_field = allowed.get(target_status)
        if timestamp_field is None:
            raise ProposalTransitionError("Invalid proposal lifecycle transition.")
        setattr(proposal, timestamp_field, timezone.now())
        proposal.status = target_status
        with _proposal_service_write_boundary():
            proposal.save(update_fields=["status", timestamp_field, "updated_at"])
    return proposal


def archive_proposal(context: ActiveWorkspaceContext, proposal: Proposal) -> Proposal:
    workspace = _authorize(context)
    with transaction.atomic():
        proposal = _proposal_for_workspace(workspace, proposal, lock=True)
        if proposal.status not in (Proposal.Status.REJECTED, Proposal.Status.EXPIRED, Proposal.Status.CONVERTED):
            raise ProposalTransitionError("Only terminal proposals can be archived.")
        proposal.archived_at = timezone.now()
        with _proposal_service_write_boundary():
            proposal.save(update_fields=["archived_at", "updated_at"])
    return proposal


def update_draft_proposal(context: ActiveWorkspaceContext, proposal: Proposal, *, title=None, notes=None, issued_on=None, valid_until=None) -> Proposal:
    """Update commercial fields only while the aggregate is still a draft."""
    workspace = _authorize(context)
    with transaction.atomic():
        proposal = _proposal_for_workspace(workspace, proposal, lock=True)
        if proposal.status != Proposal.Status.DRAFT:
            raise ProposalTransitionError("Only drafts can be edited.")
        for field, value in {"title": title, "notes": notes, "issued_on": issued_on, "valid_until": valid_until}.items():
            if value is not None:
                setattr(proposal, field, value)
        with _proposal_service_write_boundary():
            proposal.save()
    return proposal
