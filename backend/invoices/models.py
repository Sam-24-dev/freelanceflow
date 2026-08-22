import uuid
from contextlib import contextmanager
from contextvars import ContextVar
from decimal import Decimal, ROUND_HALF_UP

from django.core.exceptions import ValidationError
from django.db import models

from clients.models import Client
from fiscal.models import FiscalConfiguration
from projects.models import Project
from workspaces.models import Workspace


CENT = Decimal("0.01")
PAYMENT_TOTAL_MAX = Decimal("9999999999999999.99")
_invoice_write_depth = ContextVar("invoice_service_write_depth", default=0)


@contextmanager
def _invoice_service_write_boundary():
    token = _invoice_write_depth.set(_invoice_write_depth.get() + 1)
    try:
        yield
    finally:
        _invoice_write_depth.reset(token)


def _service_write_is_authorized():
    return _invoice_write_depth.get() > 0


class ProtectedQuerySet(models.QuerySet):
    def create(self, **kwargs):
        if not _service_write_is_authorized():
            raise ValidationError("Invoices may only be changed by invoice domain services.")
        return super().create(**kwargs)

    def update(self, **kwargs):
        if not _service_write_is_authorized():
            raise ValidationError("Invoices may only be changed by invoice domain services.")
        return super().update(**kwargs)

    def bulk_create(self, *args, **kwargs):
        raise ValidationError("Bulk invoice writes are not permitted.")

    def bulk_update(self, *args, **kwargs):
        raise ValidationError("Bulk invoice writes are not permitted.")

    def delete(self):
        raise ValidationError("Invoice history cannot be deleted.")


class InvoiceQuerySet(ProtectedQuerySet):
    def for_workspace(self, workspace):
        return self.filter(workspace=workspace)


class InvoiceManager(models.Manager.from_queryset(InvoiceQuerySet)):
    def get_queryset(self):
        return super().get_queryset().exclude(status=self.model.Status.ISSUING)


class InternalInvoiceManager(models.Manager.from_queryset(InvoiceQuerySet)):
    pass


class Invoice(models.Model):
    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        ISSUING = "ISSUING", "Issuing"
        ISSUED = "ISSUED", "Issued"
        VOID = "VOID", "Void"

    workspace = models.ForeignKey(Workspace, on_delete=models.PROTECT, related_name="invoices")
    client = models.ForeignKey(Client, on_delete=models.PROTECT, related_name="invoices")
    project = models.OneToOneField(Project, on_delete=models.PROTECT, related_name="invoice")
    fiscal_configuration = models.ForeignKey(FiscalConfiguration, on_delete=models.PROTECT, null=True, blank=True, related_name="invoices")
    public_id = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    number = models.CharField(max_length=20, null=True, blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.DRAFT)
    fiscal_version = models.PositiveIntegerField(null=True, blank=True)
    fiscal_legal_name = models.CharField(max_length=255, blank=True)
    fiscal_tax_identifier = models.CharField(max_length=100, blank=True)
    fiscal_tax_regime = models.CharField(max_length=100, blank=True)
    fiscal_applies_vat = models.BooleanField(null=True, blank=True)
    fiscal_vat_rate = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    fiscal_withholding_rate = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    issued_at = models.DateTimeField(null=True, blank=True)
    voided_at = models.DateTimeField(null=True, blank=True)
    void_reason = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = InvoiceManager()
    internal_objects = InternalInvoiceManager()

    class Meta:
        base_manager_name = "internal_objects"
        constraints = [
            models.UniqueConstraint(fields=("workspace", "number"), name="invoice_workspace_number_unique"),
            models.CheckConstraint(condition=models.Q(fiscal_vat_rate__isnull=True) | models.Q(fiscal_vat_rate__gte=Decimal("0.00"), fiscal_vat_rate__lte=Decimal("100.00")), name="invoice_fiscal_vat_rate_range"),
            models.CheckConstraint(condition=models.Q(fiscal_withholding_rate__isnull=True) | models.Q(fiscal_withholding_rate__gte=Decimal("0.00"), fiscal_withholding_rate__lte=Decimal("100.00")), name="invoice_fiscal_withholding_rate_range"),
        ]

    def clean(self):
        errors = {}
        if self.project_id:
            if self.workspace_id != self.project.workspace_id:
                errors["workspace"] = "Invoice workspace must match its project."
            if self.client_id != self.project.client_id:
                errors["client"] = "Invoice client must match its project."
        is_draft = self.status == self.Status.DRAFT
        fiscal_values = (self.fiscal_configuration_id, self.fiscal_version, self.fiscal_legal_name, self.fiscal_tax_identifier, self.fiscal_tax_regime, self.fiscal_applies_vat, self.fiscal_vat_rate, self.fiscal_withholding_rate)
        if is_draft and (self.number is not None or any(value is not None and value != "" for value in fiscal_values) or self.issued_at or self.voided_at or self.void_reason):
            errors["status"] = "Draft invoices cannot contain issued fiscal data."
        if not is_draft and (not self.number or not self.fiscal_configuration_id or not self.issued_at or any(value is None or value == "" for value in fiscal_values[1:])):
            errors["status"] = "Issued invoices require frozen fiscal data and a number."
        if self.status == self.Status.VOID and (not self.voided_at or not self.void_reason):
            errors["status"] = "Void invoices require a timestamp and reason."
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        if not _service_write_is_authorized():
            raise ValidationError("Invoices may only be changed by invoice domain services.")
        self.full_clean()
        return super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError("Invoice history cannot be deleted.")

    @property
    def subtotal(self):
        return sum((line.line_subtotal for line in self.line_items.all()), Decimal("0.00")).quantize(CENT, rounding=ROUND_HALF_UP)

    @property
    def vat_amount(self):
        return sum((line.vat_amount for line in self.line_items.all()), Decimal("0.00")).quantize(CENT, rounding=ROUND_HALF_UP)

    @property
    def withholding_amount(self):
        return sum((line.withholding_amount for line in self.line_items.all()), Decimal("0.00")).quantize(CENT, rounding=ROUND_HALF_UP)

    @property
    def total(self):
        return sum((line.line_total for line in self.line_items.all()), Decimal("0.00")).quantize(CENT, rounding=ROUND_HALF_UP)


class InvoiceSequence(models.Model):
    workspace = models.OneToOneField(Workspace, on_delete=models.PROTECT, related_name="invoice_sequence")
    next_number = models.PositiveIntegerField(default=1)

    objects = ProtectedQuerySet.as_manager()

    class Meta:
        base_manager_name = "objects"
        constraints = [models.CheckConstraint(condition=models.Q(next_number__gt=0), name="invoice_sequence_next_positive")]

    def save(self, *args, **kwargs):
        if not _service_write_is_authorized():
            raise ValidationError("Invoice sequences may only be changed by invoice domain services.")
        return super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError("Invoice sequences cannot be deleted.")


class InvoiceLineItem(models.Model):
    class UnitOfMeasure(models.TextChoices):
        HOUR = "HOUR", "Hour"
        PROJECT = "PROJECT", "Project"
        DELIVERABLE = "DELIVERABLE", "Deliverable"

    invoice = models.ForeignKey(Invoice, on_delete=models.PROTECT, related_name="line_items")
    position = models.PositiveIntegerField()
    service_name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    unit_of_measure = models.CharField(max_length=20, choices=UnitOfMeasure.choices)
    quantity = models.DecimalField(max_digits=12, decimal_places=2)
    unit_rate = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=3, default="USD")
    vat_rate = models.DecimalField(max_digits=5, decimal_places=2)
    withholding_rate = models.DecimalField(max_digits=5, decimal_places=2)

    objects = ProtectedQuerySet.as_manager()

    class Meta:
        base_manager_name = "objects"
        constraints = [
            models.UniqueConstraint(fields=("invoice", "position"), name="invoice_line_position_unique"),
            models.CheckConstraint(condition=models.Q(quantity__gt=Decimal("0.00")), name="invoice_line_quantity_positive"),
            models.CheckConstraint(condition=models.Q(unit_rate__gte=Decimal("0.00")), name="invoice_line_rate_nonnegative"),
            models.CheckConstraint(condition=models.Q(currency="USD"), name="invoice_line_currency_usd"),
            models.CheckConstraint(condition=models.Q(vat_rate__gte=Decimal("0.00"), vat_rate__lte=Decimal("100.00")), name="invoice_line_vat_rate_range"),
            models.CheckConstraint(condition=models.Q(withholding_rate__gte=Decimal("0.00"), withholding_rate__lte=Decimal("100.00")), name="invoice_line_withholding_rate_range"),
        ]

    def clean(self):
        if not self.invoice_id or any(
            value is None
            for value in (
                self.quantity,
                self.unit_rate,
                self.vat_rate,
                self.withholding_rate,
            )
        ):
            return
        existing_total = sum(
            (
                line.line_total
                for line in self.invoice.line_items.exclude(pk=self.pk)
            ),
            Decimal("0.00"),
        )
        if existing_total + self.line_total > PAYMENT_TOTAL_MAX:
            raise ValidationError(
                {"quantity": "Invoice total exceeds the payment ledger capacity."}
            )

    def save(self, *args, **kwargs):
        if not _service_write_is_authorized():
            raise ValidationError("Invoice line items may only be changed by invoice domain services.")
        self.full_clean()
        return super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError("Invoice line items are immutable.")

    @property
    def line_subtotal(self):
        return (self.quantity * self.unit_rate).quantize(CENT, rounding=ROUND_HALF_UP)

    @property
    def vat_amount(self):
        return ((self.line_subtotal * self.vat_rate) / Decimal("100")).quantize(CENT, rounding=ROUND_HALF_UP)

    @property
    def withholding_amount(self):
        return ((self.line_subtotal * self.withholding_rate) / Decimal("100")).quantize(CENT, rounding=ROUND_HALF_UP)

    @property
    def line_total(self):
        return (self.line_subtotal + self.vat_amount - self.withholding_amount).quantize(CENT, rounding=ROUND_HALF_UP)
