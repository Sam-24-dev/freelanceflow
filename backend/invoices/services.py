from django.db import IntegrityError, transaction
from django.db.models import Exists, OuterRef
from django.utils import timezone

from fiscal.models import FiscalConfiguration
from projects.models import Project
from proposals.models import Proposal
from workspaces.context import ActiveWorkspaceContext
from workspaces.models import Membership, Workspace
from workspaces.permissions import can_perform_operational_work

from payments.models import Payment, PaymentReversal

from .models import Invoice, InvoiceLineItem, InvoiceSequence, _invoice_service_write_boundary


class InvoiceAccessDenied(PermissionError):
    pass


class InvoiceTransitionError(ValueError):
    pass


def _authorize(context: ActiveWorkspaceContext):
    try:
        membership = Membership.objects.get(pk=context.membership.pk, workspace=context.workspace)
    except Membership.DoesNotExist as error:
        raise InvoiceAccessDenied("Active workspace membership is required.") from error
    if not can_perform_operational_work(membership):
        raise InvoiceAccessDenied("Invoice access requires an owner or operational membership.")
    return context.workspace


def _locked_project(workspace, project):
    try:
        return Project.objects.for_workspace(workspace).select_for_update().get(pk=project.pk)
    except Project.DoesNotExist as error:
        raise InvoiceAccessDenied("Project is not available in the active workspace.") from error


def _locked_invoice(workspace, invoice):
    try:
        return Invoice.objects.for_workspace(workspace).select_for_update().get(pk=invoice.pk)
    except Invoice.DoesNotExist as error:
        raise InvoiceAccessDenied("Invoice is not available in the active workspace.") from error


def create_draft_invoice(context: ActiveWorkspaceContext, project: Project):
    workspace = _authorize(context)
    with transaction.atomic():
        locked_project = _locked_project(workspace, project)
        try:
            return Invoice.objects.for_workspace(workspace).get(project=locked_project)
        except Invoice.DoesNotExist:
            with _invoice_service_write_boundary():
                return Invoice.objects.create(
                    workspace=locked_project.workspace,
                    client=locked_project.client,
                    project=locked_project,
                )


def _locked_sequence(workspace):
    try:
        return InvoiceSequence.objects.select_for_update().get(workspace=workspace)
    except InvoiceSequence.DoesNotExist:
        try:
            with _invoice_service_write_boundary():
                return InvoiceSequence.objects.create(workspace=workspace, next_number=1)
        except IntegrityError:
            return InvoiceSequence.objects.select_for_update().get(workspace=workspace)


def issue_invoice(context: ActiveWorkspaceContext, invoice: Invoice):
    workspace = _authorize(context)
    with transaction.atomic():
        locked_workspace = Workspace.objects.select_for_update().get(pk=workspace.pk)
        locked_project = _locked_project(locked_workspace, invoice.project)
        try:
            locked_proposal = Proposal.objects.for_workspace(locked_workspace).select_for_update().get(pk=locked_project.proposal_id)
        except Proposal.DoesNotExist as error:
            raise InvoiceTransitionError("Invoice project source is unavailable.") from error
        fiscal = FiscalConfiguration.objects.for_workspace(locked_workspace).select_for_update().order_by("-version").first()
        if fiscal is None:
            raise InvoiceTransitionError("A fiscal configuration is required before issuing an invoice.")
        sequence = _locked_sequence(locked_workspace)
        locked_invoice = _locked_invoice(locked_workspace, invoice)
        if locked_invoice.status == Invoice.Status.ISSUED:
            return locked_invoice
        if locked_invoice.status != Invoice.Status.DRAFT:
            raise InvoiceTransitionError("Only draft invoices can be issued.")
        if locked_invoice.project_id != locked_project.pk or locked_project.proposal_id != locked_proposal.pk:
            raise InvoiceTransitionError("Invoice source is inconsistent.")
        source_lines = list(locked_proposal.line_items.select_for_update().order_by("position"))
        if not source_lines:
            raise InvoiceTransitionError("An invoice requires proposal line items.")
        number = "INV-{:06d}".format(sequence.next_number)
        now = timezone.now()
        with _invoice_service_write_boundary():
            sequence.next_number += 1
            sequence.save(update_fields=["next_number"])
            locked_invoice.number = number
            locked_invoice.fiscal_configuration = fiscal
            locked_invoice.fiscal_version = fiscal.version
            locked_invoice.fiscal_legal_name = fiscal.legal_name
            locked_invoice.fiscal_tax_identifier = fiscal.tax_identifier
            locked_invoice.fiscal_tax_regime = fiscal.tax_regime
            locked_invoice.fiscal_applies_vat = fiscal.applies_vat
            locked_invoice.fiscal_vat_rate = fiscal.vat_rate
            locked_invoice.fiscal_withholding_rate = fiscal.withholding_rate
            locked_invoice.status = Invoice.Status.ISSUING
            locked_invoice.issued_at = now
            locked_invoice.save()
            for source in source_lines:
                InvoiceLineItem.objects.create(
                    invoice=locked_invoice,
                    position=source.position,
                    service_name=source.service_name,
                    description=source.description,
                    unit_of_measure=source.unit_of_measure,
                    quantity=source.quantity,
                    unit_rate=source.unit_rate,
                    currency=source.currency,
                    vat_rate=fiscal.vat_rate if fiscal.applies_vat else 0,
                    withholding_rate=fiscal.withholding_rate,
                )
            locked_invoice.status = Invoice.Status.ISSUED
            locked_invoice.save()
        return locked_invoice


def _has_active_payment(invoice: Invoice) -> bool:
    reversal = PaymentReversal.objects.filter(payment_id=OuterRef("pk"))
    return Payment.objects.filter(invoice=invoice).annotate(
        is_reversed=Exists(reversal)
    ).filter(is_reversed=False).exists()



def void_invoice(context: ActiveWorkspaceContext, invoice: Invoice, *, reason: str):
    workspace = _authorize(context)
    if not reason.strip():
        raise InvoiceTransitionError("A void reason is required.")
    with transaction.atomic():
        locked_invoice = _locked_invoice(workspace, invoice)
        if locked_invoice.status != Invoice.Status.ISSUED:
            raise InvoiceTransitionError("Only issued invoices can be voided.")
        if _has_active_payment(locked_invoice):
            raise InvoiceTransitionError("Issued invoices with active payments cannot be voided.")
        with _invoice_service_write_boundary():
            locked_invoice.status = Invoice.Status.VOID
            locked_invoice.voided_at = timezone.now()
            locked_invoice.void_reason = reason.strip()
            locked_invoice.save()
        return locked_invoice
