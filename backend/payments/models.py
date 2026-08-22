import uuid
from contextlib import contextmanager
from contextvars import ContextVar
from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from invoices.models import Invoice
from workspaces.models import Workspace


CENT = Decimal("0.01")
_payment_write_depth = ContextVar("payment_service_write_depth", default=0)


@contextmanager
def payment_service_write_boundary():
    """Permit append-only ledger inserts from payment domain services only."""
    token = _payment_write_depth.set(_payment_write_depth.get() + 1)
    try:
        yield
    finally:
        _payment_write_depth.reset(token)


def _service_write_is_authorized() -> bool:
    return _payment_write_depth.get() > 0


class PaymentLedgerQuerySet(models.QuerySet):
    def create(self, **kwargs):
        if not _service_write_is_authorized():
            raise ValidationError("Payments may only be recorded by payment domain services.")
        return super().create(**kwargs)

    def update(self, **kwargs):
        raise ValidationError("Payment ledger entries are immutable.")

    def bulk_create(self, *args, **kwargs):
        raise ValidationError("Bulk payment ledger writes are not permitted.")

    def bulk_update(self, *args, **kwargs):
        raise ValidationError("Bulk payment ledger writes are not permitted.")

    def delete(self):
        raise ValidationError("Payment ledger history cannot be deleted.")


class PaymentLedgerManager(models.Manager.from_queryset(PaymentLedgerQuerySet)):
    def for_workspace(self, workspace: Workspace):
        return self.get_queryset().filter(workspace=workspace)


class Payment(models.Model):
    """Immutable append-only receipt ledger entry for one issued invoice."""

    workspace = models.ForeignKey(Workspace, on_delete=models.PROTECT, related_name="payments")
    invoice = models.ForeignKey(Invoice, on_delete=models.PROTECT, related_name="payments")
    public_id = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    idempotency_key = models.UUIDField()
    fingerprint = models.CharField(max_length=64, editable=False)
    amount = models.DecimalField(max_digits=18, decimal_places=2)
    currency = models.CharField(max_length=3, default="USD")
    source_type = models.CharField(max_length=40)
    source_reference = models.CharField(max_length=255)
    received_at = models.DateTimeField()
    invoice_number_snapshot = models.CharField(max_length=20)
    invoice_total_snapshot = models.DecimalField(max_digits=18, decimal_places=2)
    invoice_currency_snapshot = models.CharField(max_length=3, default="USD")
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="recorded_payments")
    created_at = models.DateTimeField(auto_now_add=True)

    objects = PaymentLedgerManager()

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=("workspace", "idempotency_key"), name="payment_workspace_idempotency_unique"),
            models.CheckConstraint(condition=models.Q(amount__gt=Decimal("0.00")), name="payment_amount_positive"),
            models.CheckConstraint(condition=models.Q(currency="USD"), name="payment_currency_usd"),
            models.CheckConstraint(condition=models.Q(invoice_currency_snapshot="USD"), name="payment_snapshot_currency_usd"),
        ]

    @classmethod
    def direct_sql_trigger_locking_proof_contract(cls) -> dict:
        """The executable runtime proof required before relying on trigger locks."""
        return {
            "mysql_version": "8.4",
            "trigger_locking_read": "SELECT ... FOR UPDATE",
            "proof_cases": ("payment_vs_void", "reversal_vs_void", "raw_overpayment"),
            "inspect_trigger_ddl": True,
        }

    def clean(self):
        errors = {}
        if self.currency != "USD":
            errors["currency"] = "Payments must be recorded in USD."
        if self.invoice_currency_snapshot != "USD":
            errors["invoice_currency_snapshot"] = "Invoice snapshots must be in USD."
        if self.amount is None or self.amount <= Decimal("0.00") or self.amount != self.amount.quantize(CENT):
            errors["amount"] = "Payment amounts must be strictly positive exact cents."
        if self.invoice_id and self.workspace_id != self.invoice.workspace_id:
            errors["workspace"] = "Payment workspace must match its invoice."
        if not self.source_type.strip() or not self.source_reference.strip():
            errors["source_reference"] = "Payment source type and reference are required."
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        if not self._state.adding or not _service_write_is_authorized():
            raise ValidationError("Payment ledger entries are immutable and service-created only.")
        self.full_clean()
        return super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError("Payment ledger history cannot be deleted.")


class PaymentReversal(models.Model):
    """Immutable full reversal of exactly one payment ledger entry."""

    workspace = models.ForeignKey(Workspace, on_delete=models.PROTECT, related_name="payment_reversals")
    invoice = models.ForeignKey(Invoice, on_delete=models.PROTECT, related_name="payment_reversals")
    payment = models.ForeignKey(Payment, on_delete=models.PROTECT, related_name="reversals")
    public_id = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    idempotency_key = models.UUIDField()
    fingerprint = models.CharField(max_length=64, editable=False)
    amount = models.DecimalField(max_digits=18, decimal_places=2)
    currency = models.CharField(max_length=3, default="USD")
    reason = models.CharField(max_length=255)
    reversed_at = models.DateTimeField()
    invoice_number_snapshot = models.CharField(max_length=20)
    invoice_total_snapshot = models.DecimalField(max_digits=18, decimal_places=2)
    invoice_currency_snapshot = models.CharField(max_length=3, default="USD")
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="recorded_payment_reversals")
    created_at = models.DateTimeField(auto_now_add=True)

    objects = PaymentLedgerManager()

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=("workspace", "idempotency_key"), name="payment_reversal_workspace_idempotency_unique"),
            models.UniqueConstraint(fields=("payment",), name="payment_reversal_once"),
            models.CheckConstraint(condition=models.Q(amount__gt=Decimal("0.00")), name="payment_reversal_amount_positive"),
            models.CheckConstraint(condition=models.Q(currency="USD"), name="payment_reversal_currency_usd"),
            models.CheckConstraint(condition=models.Q(invoice_currency_snapshot="USD"), name="payment_reversal_snapshot_currency_usd"),
        ]

    def clean(self):
        errors = {}
        if self.currency != "USD":
            errors["currency"] = "Payment reversals must be recorded in USD."
        if self.amount is None or self.amount <= Decimal("0.00") or self.amount != self.amount.quantize(CENT):
            errors["amount"] = "Reversal amounts must be strictly positive exact cents."
        if self.payment_id:
            if self.workspace_id != self.payment.workspace_id or self.invoice_id != self.payment.invoice_id:
                errors["payment"] = "A reversal must remain in its payment invoice and workspace."
            if self.amount != self.payment.amount or self.currency != self.payment.currency:
                errors["amount"] = "Reversals must exactly equal the original payment."
        if not self.reason.strip():
            errors["reason"] = "A reversal reason is required."
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        if not self._state.adding or not _service_write_is_authorized():
            raise ValidationError("Payment reversals are immutable and service-created only.")
        self.full_clean()
        return super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError("Payment reversal history cannot be deleted.")