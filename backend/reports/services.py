"""Tenant-scoped, query-only cash activity reporting over durable event streams."""

from dataclasses import dataclass
from datetime import date, datetime, time
from decimal import Decimal
from uuid import UUID
from zoneinfo import ZoneInfo

from django.core.exceptions import ValidationError
from django.utils import timezone

from ledger.models import LedgerEntry
from payments.models import Payment, PaymentReversal
from workspaces.context import ActiveWorkspaceContext
from workspaces.models import Membership, Workspace
from workspaces.permissions import can_perform_operational_work


REPORT_TIMEZONE = ZoneInfo("America/Guayaquil")
REPORT_TIMEZONE_NAME = "America/Guayaquil"
ZERO = Decimal("0.00")


class CashActivityAccessDenied(PermissionError):
    """Raised when the active workspace is not allowed to read cash activity."""


class CashActivityValidationError(ValueError):
    """Raised when a requested reporting period is invalid."""


@dataclass(frozen=True, slots=True)
class CashActivityGroup:
    """One tenant-local grouping with exact signed cash totals."""

    key: UUID
    cash_in: Decimal
    cash_out: Decimal
    net: Decimal


@dataclass(frozen=True, slots=True)
class CashActivityReport:
    """Immutable query result for an inclusive Guayaquil business-date period."""

    start_date: date
    end_date: date
    timezone: str
    as_of: datetime
    cash_in: Decimal
    cash_out: Decimal
    net: Decimal
    by_client: tuple[CashActivityGroup, ...]
    by_project: tuple[CashActivityGroup, ...]
    by_category: tuple[CashActivityGroup, ...]


def _authorize(context: ActiveWorkspaceContext) -> Workspace:
    if not isinstance(context, ActiveWorkspaceContext):
        raise CashActivityAccessDenied("An active workspace context is required.")
    try:
        membership = Membership.objects.select_related("user").get(
            pk=context.membership.pk,
            workspace=context.workspace,
        )
    except (AttributeError, Membership.DoesNotExist, TypeError, ValueError, ValidationError) as error:
        raise CashActivityAccessDenied("Active workspace membership is required.") from error
    if not membership.user.is_active or not can_perform_operational_work(membership):
        raise CashActivityAccessDenied(
            "Cash activity access requires an active owner or operational membership."
        )
    return context.workspace


def _period(start_date: date, end_date: date) -> tuple[datetime, datetime]:
    if isinstance(start_date, datetime) or isinstance(end_date, datetime):
        raise CashActivityValidationError("Cash activity boundaries must be dates, not datetimes.")
    if not isinstance(start_date, date) or not isinstance(end_date, date):
        raise CashActivityValidationError("Cash activity boundaries must be dates.")
    if end_date < start_date:
        raise CashActivityValidationError("Cash activity end date cannot precede start date.")
    start = datetime.combine(start_date, time.min, tzinfo=REPORT_TIMEZONE)
    end_exclusive = datetime.combine(end_date.fromordinal(end_date.toordinal() + 1), time.min, tzinfo=REPORT_TIMEZONE)
    return start, end_exclusive


def _new_totals() -> dict[str, Decimal]:
    return {"cash_in": ZERO, "cash_out": ZERO}


def _record(totals: dict[str, Decimal], *, amount: Decimal, cash_in: bool) -> None:
    totals["cash_in" if cash_in else "cash_out"] += amount


def _groups(groups: dict[UUID, dict[str, Decimal]]) -> tuple[CashActivityGroup, ...]:
    return tuple(
        CashActivityGroup(
            key=key,
            cash_in=totals["cash_in"],
            cash_out=totals["cash_out"],
            net=totals["cash_in"] - totals["cash_out"],
        )
        for key, totals in sorted(groups.items(), key=lambda item: str(item[0]))
    )


def _record_group(
    groups: dict[UUID, dict[str, Decimal]],
    key: UUID | None,
    *,
    amount: Decimal,
    cash_in: bool,
) -> None:
    if key is None:
        return
    totals = groups.setdefault(key, _new_totals())
    _record(totals, amount=amount, cash_in=cash_in)


def get_cash_activity_report(
    context: ActiveWorkspaceContext,
    *,
    start_date: date,
    end_date: date,
) -> CashActivityReport:
    """Return immutable USD cash activity from independent, scoped durable events.

    Ledger entries retain their stored direction. Payment receipts and payment
    reversals are separate event streams and are matched on Guayaquil calendar
    dates, so a later reversal never erases the date of its original receipt.
    """
    workspace = _authorize(context)
    payment_start, payment_end_exclusive = _period(start_date, end_date)
    totals = _new_totals()
    clients: dict[UUID, dict[str, Decimal]] = {}
    projects: dict[UUID, dict[str, Decimal]] = {}
    categories: dict[UUID, dict[str, Decimal]] = {}

    ledger_entries = (
        LedgerEntry.objects.for_workspace(workspace)
        .filter(
            source__in=(LedgerEntry.Source.MANUAL, LedgerEntry.Source.REVERSAL),
            currency="USD",
            occurred_on__range=(start_date, end_date),
        )
        .select_related("client", "project", "category")
    )
    for entry in ledger_entries:
        cash_in = entry.direction == LedgerEntry.Direction.INCOME
        _record(totals, amount=entry.amount, cash_in=cash_in)
        _record_group(clients, None if entry.client_id is None else entry.client.public_id, amount=entry.amount, cash_in=cash_in)
        _record_group(projects, None if entry.project_id is None else entry.project.public_id, amount=entry.amount, cash_in=cash_in)
        _record_group(categories, None if entry.category_id is None else entry.category.public_id, amount=entry.amount, cash_in=cash_in)

    receipts = (
        Payment.objects.for_workspace(workspace)
        .filter(currency="USD", received_at__gte=payment_start, received_at__lt=payment_end_exclusive)
        .select_related("invoice__client", "invoice__project")
    )
    for receipt in receipts:
        _record(totals, amount=receipt.amount, cash_in=True)
        _record_group(clients, receipt.invoice.client.public_id, amount=receipt.amount, cash_in=True)
        _record_group(projects, receipt.invoice.project.public_id, amount=receipt.amount, cash_in=True)

    reversals = (
        PaymentReversal.objects.for_workspace(workspace)
        .filter(currency="USD", reversed_at__gte=payment_start, reversed_at__lt=payment_end_exclusive)
        .select_related("invoice__client", "invoice__project")
    )
    for reversal in reversals:
        _record(totals, amount=reversal.amount, cash_in=False)
        _record_group(clients, reversal.invoice.client.public_id, amount=reversal.amount, cash_in=False)
        _record_group(projects, reversal.invoice.project.public_id, amount=reversal.amount, cash_in=False)

    return CashActivityReport(
        start_date=start_date,
        end_date=end_date,
        timezone=REPORT_TIMEZONE_NAME,
        as_of=timezone.now(),
        cash_in=totals["cash_in"],
        cash_out=totals["cash_out"],
        net=totals["cash_in"] - totals["cash_out"],
        by_client=_groups(clients),
        by_project=_groups(projects),
        by_category=_groups(categories),
    )