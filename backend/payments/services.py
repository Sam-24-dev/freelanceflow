import hashlib
import json
from datetime import datetime, timezone as datetime_timezone
from decimal import Decimal, InvalidOperation
from typing import Any
from uuid import UUID

from django.db import IntegrityError, transaction
from django.db.models import Exists, OuterRef, Sum
from django.utils import timezone

from invoices.models import Invoice
from workspaces.context import ActiveWorkspaceContext
from workspaces.models import Membership
from workspaces.permissions import can_perform_operational_work
from notifications.services import fan_out_payment_recorded_notifications

from .models import CENT, Payment, PaymentReversal, payment_service_write_boundary


class PaymentAccessDenied(PermissionError):
    pass


class PaymentValidationError(ValueError):
    pass


class PaymentIdempotencyConflict(PaymentValidationError):
    pass


def _authorize(context: ActiveWorkspaceContext):
    try:
        membership = Membership.objects.get(pk=context.membership.pk, workspace=context.workspace)
    except Membership.DoesNotExist as error:
        raise PaymentAccessDenied("Active workspace membership is required.") from error
    if not can_perform_operational_work(membership):
        raise PaymentAccessDenied("Payment access requires an owner or operational membership.")
    return context.workspace, membership


def _locked_invoice(workspace, invoice: Invoice) -> Invoice:
    try:
        return Invoice.internal_objects.for_workspace(workspace).select_for_update().get(pk=invoice.pk)
    except Invoice.DoesNotExist as error:
        raise PaymentAccessDenied("Invoice is not available in the active workspace.") from error


def _uuid(value, field: str) -> UUID:
    try:
        return UUID(str(value))
    except (TypeError, ValueError, AttributeError) as error:
        raise PaymentValidationError(f"{field} must be a UUID.") from error



def _exact_amount(value: Decimal | str | int) -> Decimal:
    try:
        amount = Decimal(str(value))
    except (InvalidOperation, ValueError) as error:
        raise PaymentValidationError("Amount must be a decimal value.") from error
    if not amount.is_finite() or amount <= Decimal("0.00") or amount != amount.quantize(CENT):
        raise PaymentValidationError("Amount must be a strictly positive exact-cent value.")
    if len(amount.as_tuple().digits) > 18:
        raise PaymentValidationError("Amount exceeds Decimal(18,2).")
    return amount


def _normalized_text(value: str, field: str, *, upper: bool = False) -> str:
    normalized = value.strip()
    if upper:
        normalized = normalized.upper()
    if not normalized:
        raise PaymentValidationError(f"{field} is required.")
    return normalized


def _timestamp(value: datetime | None, field: str) -> datetime:
    timestamp = value or timezone.now()
    if not isinstance(timestamp, datetime):
        raise PaymentValidationError(f"{field} must be a datetime.")
    if timezone.is_naive(timestamp):
        raise PaymentValidationError(f"{field} must be timezone-aware.")
    return timestamp


def _canonical_timestamp(timestamp: datetime) -> str:
    return timestamp.astimezone(datetime_timezone.utc).isoformat(
        timespec="microseconds"
    ).replace("+00:00", "Z")



def _fingerprint(payload: dict[str, Any]) -> str:
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=True).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def _payment_fingerprint(invoice: Invoice, amount: Decimal, currency: str, source_type: str, source_reference: str, received_at: datetime) -> str:
    return _fingerprint(
        {
            "amount": format(amount, ".2f"),
            "currency": currency,
            "invoice": str(invoice.public_id),
            "received_at": _canonical_timestamp(received_at),
            "source_reference": source_reference,
            "source_type": source_type,
        }
    )


def _reversal_fingerprint(payment: Payment, invoice: Invoice, amount: Decimal, currency: str, reason: str, reversed_at: datetime) -> str:
    return _fingerprint(
        {
            "amount": format(amount, ".2f"),
            "currency": currency,
            "invoice": str(invoice.public_id),
            "payment": str(payment.public_id),
            "reason": reason,
            "reversed_at": _canonical_timestamp(reversed_at),
        }
    )


def _active_paid_total(invoice: Invoice) -> Decimal:
    reversed_payment = PaymentReversal.objects.filter(payment_id=OuterRef("pk"))
    total = (
        Payment.objects.filter(invoice=invoice)
        .annotate(is_reversed=Exists(reversed_payment))
        .filter(is_reversed=False)
        .aggregate(total=Sum("amount"))["total"]
    )
    return total or Decimal("0.00")


def _issued_invoice_total(invoice: Invoice) -> Decimal:
    if invoice.status != Invoice.Status.ISSUED:
        raise PaymentValidationError("Payments and reversals require an issued invoice.")
    return invoice.total


def _assert_same_fingerprint(existing, fingerprint: str):
    if existing.fingerprint != fingerprint:
        raise PaymentIdempotencyConflict("Idempotency key was already used with different payment data.")
    return existing


def record_payment(
    context: ActiveWorkspaceContext,
    invoice: Invoice,
    *,
    amount: Decimal | str | int,
    idempotency_key,
    source_type: str,
    source_reference: str,
    received_at: datetime | None = None,
    currency: str = "USD",
) -> Payment:
    """Append one payment, returning the prior row only for an identical retry."""
    workspace, membership = _authorize(context)
    idempotency_key = _uuid(idempotency_key, "Idempotency key")
    amount = _exact_amount(amount)
    normalized_currency = _normalized_text(currency, "Currency", upper=True)
    if normalized_currency != "USD":
        raise PaymentValidationError("Payments are only supported in USD.")
    source_type = _normalized_text(source_type, "Source type", upper=True)
    source_reference = _normalized_text(source_reference, "Source reference")
    received_at = _timestamp(received_at, "Received at")

    with transaction.atomic():
        locked_invoice = _locked_invoice(workspace, invoice)
        total = _issued_invoice_total(locked_invoice)
        fingerprint = _payment_fingerprint(locked_invoice, amount, normalized_currency, source_type, source_reference, received_at)
        existing = Payment.objects.for_workspace(workspace).filter(idempotency_key=idempotency_key).first()
        if existing is not None:
            return _assert_same_fingerprint(existing, fingerprint)
        if _active_paid_total(locked_invoice) + amount > total:
            raise PaymentValidationError("Payment would overpay the issued invoice.")
        try:
            with transaction.atomic():
                with payment_service_write_boundary():
                    payment = Payment.objects.create(
                        workspace=workspace,
                        invoice=locked_invoice,
                        idempotency_key=idempotency_key,
                        fingerprint=fingerprint,
                        amount=amount,
                        currency=normalized_currency,
                        source_type=source_type,
                        source_reference=source_reference,
                        received_at=received_at,
                        invoice_number_snapshot=locked_invoice.number,
                        invoice_total_snapshot=total,
                        invoice_currency_snapshot="USD",
                        created_by=membership.user,
                    )
        except IntegrityError:
            existing = Payment.objects.for_workspace(workspace).filter(idempotency_key=idempotency_key).first()
            if existing is None:
                raise
            return _assert_same_fingerprint(existing, fingerprint)
        fan_out_payment_recorded_notifications(payment, actor_membership=membership)
        return payment


def reverse_payment(
    context: ActiveWorkspaceContext,
    invoice: Invoice,
    payment: Payment,
    *,
    idempotency_key,
    reason: str,
    reversed_at: datetime | None = None,
    amount: Decimal | str | int | None = None,
    currency: str = "USD",
) -> PaymentReversal:
    """Append the one permitted full reversal of a payment, with retry safety."""
    workspace, membership = _authorize(context)
    idempotency_key = _uuid(idempotency_key, "Idempotency key")
    reason = _normalized_text(reason, "Reversal reason")
    normalized_currency = _normalized_text(currency, "Currency", upper=True)
    if normalized_currency != "USD":
        raise PaymentValidationError("Reversals are only supported in USD.")
    reversed_at = _timestamp(reversed_at, "Reversed at")

    with transaction.atomic():
        locked_invoice = _locked_invoice(workspace, invoice)
        _issued_invoice_total(locked_invoice)
        existing = PaymentReversal.objects.for_workspace(workspace).filter(idempotency_key=idempotency_key).first()
        try:
            locked_payment = Payment.objects.for_workspace(workspace).select_for_update().get(pk=payment.pk, invoice=locked_invoice)
        except Payment.DoesNotExist as error:
            raise PaymentAccessDenied("Payment is not available for this issued invoice.") from error
        reversal_amount = _exact_amount(locked_payment.amount if amount is None else amount)
        if reversal_amount != locked_payment.amount or normalized_currency != locked_payment.currency:
            raise PaymentValidationError("A reversal must exactly equal the original payment amount and currency.")
        fingerprint = _reversal_fingerprint(locked_payment, locked_invoice, reversal_amount, normalized_currency, reason, reversed_at)
        if existing is not None:
            return _assert_same_fingerprint(existing, fingerprint)
        if PaymentReversal.objects.filter(payment=locked_payment).exists():
            raise PaymentValidationError("A payment may only be reversed once.")
        try:
            with transaction.atomic():
                with payment_service_write_boundary():
                    return PaymentReversal.objects.create(
                        workspace=workspace,
                        invoice=locked_invoice,
                        payment=locked_payment,
                        idempotency_key=idempotency_key,
                        fingerprint=fingerprint,
                        amount=reversal_amount,
                        currency=normalized_currency,
                        reason=reason,
                        reversed_at=reversed_at,
                        invoice_number_snapshot=locked_payment.invoice_number_snapshot,
                        invoice_total_snapshot=locked_payment.invoice_total_snapshot,
                        invoice_currency_snapshot=locked_payment.invoice_currency_snapshot,
                        created_by=membership.user,
                    )
        except IntegrityError:
            existing = PaymentReversal.objects.for_workspace(workspace).filter(idempotency_key=idempotency_key).first()
            if existing is None:
                raise
            return _assert_same_fingerprint(existing, fingerprint)
