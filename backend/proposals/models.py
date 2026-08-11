import uuid
from contextlib import contextmanager
from contextvars import ContextVar
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models

from clients.models import Client
from services.models import Service
from workspaces.models import Workspace


_service_write_depth = ContextVar("proposal_service_write_depth", default=0)


@contextmanager
def _proposal_service_write_boundary():
    """Coordinate trusted proposal writes within this Python process.

    This is a convenience boundary for the domain service API, not a security
    boundary: same-process Python code can import private names. MySQL triggers
    provide the durable protection against direct database writes.
    """
    token = _service_write_depth.set(_service_write_depth.get() + 1)
    try:
        yield
    finally:
        _service_write_depth.reset(token)


def _service_write_is_authorized() -> bool:
    return _service_write_depth.get() > 0


class ProposalQuerySet(models.QuerySet):
    def for_workspace(self, workspace: Workspace):
        return self.filter(workspace=workspace)

    def _reject_sent_rows(self):
        if _service_write_is_authorized():
            return
        if self.model is Proposal:
            frozen = self.exclude(status=Proposal.Status.DRAFT)
        else:
            frozen = self.exclude(proposal__status=Proposal.Status.DRAFT)
        if frozen.exists():
            raise ValidationError("Proposal commercial data is immutable outside domain services after sending.")

    def update(self, **kwargs):
        self._reject_sent_rows()
        return super().update(**kwargs)

    def delete(self):
        self._reject_sent_rows()
        return super().delete()

    def bulk_update(self, objs, fields, batch_size=None):
        if not _service_write_is_authorized():
            primary_keys = [obj.pk for obj in objs if obj.pk is not None]
            if primary_keys:
                self.filter(pk__in=primary_keys)._reject_sent_rows()
        return super().bulk_update(objs, fields, batch_size=batch_size)

    def bulk_create(self, objs, batch_size=None, ignore_conflicts=False, update_conflicts=False, update_fields=None, unique_fields=None):
        if not _service_write_is_authorized():
            if self.model is Proposal:
                if any(obj.status != Proposal.Status.DRAFT for obj in objs):
                    raise ValidationError("Proposals must be created as drafts outside domain services.")
            else:
                proposal_ids = {obj.proposal_id for obj in objs if obj.proposal_id is not None}
                if Proposal.objects.filter(pk__in=proposal_ids).exclude(status=Proposal.Status.DRAFT).exists():
                    raise ValidationError("Proposal lines are immutable after sending.")
        return super().bulk_create(
            objs, batch_size=batch_size, ignore_conflicts=ignore_conflicts,
            update_conflicts=update_conflicts, update_fields=update_fields, unique_fields=unique_fields,
        )


class Proposal(models.Model):
    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        SENT = "SENT", "Sent"
        ACCEPTED = "ACCEPTED", "Accepted"
        REJECTED = "REJECTED", "Rejected"
        EXPIRED = "EXPIRED", "Expired"
        CONVERTED = "CONVERTED", "Converted"

    workspace = models.ForeignKey(Workspace, on_delete=models.PROTECT, related_name="proposals")
    client = models.ForeignKey(Client, on_delete=models.PROTECT, related_name="proposals")
    public_id = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    title = models.CharField(max_length=255)
    notes = models.TextField(blank=True)
    issued_on = models.DateField()
    valid_until = models.DateField()
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.DRAFT)
    sent_at = models.DateTimeField(null=True, blank=True)
    accepted_at = models.DateTimeField(null=True, blank=True)
    rejected_at = models.DateTimeField(null=True, blank=True)
    expired_at = models.DateTimeField(null=True, blank=True)
    converted_at = models.DateTimeField(null=True, blank=True)
    archived_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = ProposalQuerySet.as_manager()

    class Meta:
        base_manager_name = "objects"
        constraints = [
            models.CheckConstraint(condition=models.Q(valid_until__gte=models.F("issued_on")), name="proposal_valid_until_on_or_after_issued"),
            models.CheckConstraint(
                condition=(
                    models.Q(status="DRAFT", sent_at__isnull=True, accepted_at__isnull=True, rejected_at__isnull=True, expired_at__isnull=True, converted_at__isnull=True)
                    | models.Q(status="SENT", sent_at__isnull=False, accepted_at__isnull=True, rejected_at__isnull=True, expired_at__isnull=True, converted_at__isnull=True)
                    | models.Q(status="ACCEPTED", sent_at__isnull=False, accepted_at__isnull=False, rejected_at__isnull=True, expired_at__isnull=True, converted_at__isnull=True)
                    | models.Q(status="REJECTED", sent_at__isnull=False, accepted_at__isnull=True, rejected_at__isnull=False, expired_at__isnull=True, converted_at__isnull=True)
                    | models.Q(status="EXPIRED", sent_at__isnull=False, accepted_at__isnull=True, rejected_at__isnull=True, expired_at__isnull=False, converted_at__isnull=True)
                    | models.Q(status="CONVERTED", sent_at__isnull=False, accepted_at__isnull=False, rejected_at__isnull=True, expired_at__isnull=True, converted_at__isnull=False)
                ),
                name="proposal_status_timestamps_consistent",
            ),
            models.CheckConstraint(
                condition=models.Q(archived_at__isnull=True) | models.Q(status__in=["REJECTED", "EXPIRED", "CONVERTED"]),
                name="proposal_archive_requires_terminal_status",
            ),
        ]

    @property
    def total(self) -> Decimal:
        return sum((line.line_total for line in self.line_items.all()), Decimal("0.00")).quantize(Decimal("0.01"))

    def clean(self):
        errors = {}
        if self.client_id and self.workspace_id and self.client.workspace_id != self.workspace_id:
            errors["client"] = "Client must belong to the proposal workspace."
        if not self._state.adding:
            current = type(self).objects.get(pk=self.pk)
            immutable_fields = ("workspace_id", "client_id", "title", "notes", "issued_on", "valid_until")
            if current.status != self.Status.DRAFT and any(
                getattr(current, field) != getattr(self, field) for field in immutable_fields
            ):
                errors["__all__"] = "Proposal content is immutable after sending."
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        if not self._state.adding and not _service_write_is_authorized():
            raise ValidationError("Persisted proposals may only be changed by proposal domain services.")
        self.full_clean()
        return super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        if not _service_write_is_authorized():
            raise ValidationError("Persisted proposals may only be deleted by proposal domain services.")
        return super().delete(*args, **kwargs)


class ProposalLineItem(models.Model):
    class UnitOfMeasure(models.TextChoices):
        HOUR = "HOUR", "Hour"
        PROJECT = "PROJECT", "Project"
        DELIVERABLE = "DELIVERABLE", "Deliverable"

    class Currency(models.TextChoices):
        USD = "USD", "US Dollar"

    proposal = models.ForeignKey(Proposal, on_delete=models.CASCADE, related_name="line_items")
    position = models.PositiveIntegerField()
    source_service = models.ForeignKey(Service, on_delete=models.PROTECT, null=True, blank=True, related_name="proposal_line_items")
    service_name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    unit_of_measure = models.CharField(max_length=20, choices=UnitOfMeasure.choices)
    quantity = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(Decimal("0.01"))])
    unit_rate = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(Decimal("0.00"))])
    currency = models.CharField(max_length=3, choices=Currency.choices, default=Currency.USD)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = ProposalQuerySet.as_manager()

    class Meta:
        base_manager_name = "objects"
        constraints = [
            models.UniqueConstraint(fields=["proposal", "position"], name="unique_proposal_line_position"),
            models.CheckConstraint(condition=models.Q(quantity__gt=Decimal("0.00")), name="proposal_line_quantity_positive"),
            models.CheckConstraint(condition=models.Q(unit_rate__gte=Decimal("0.00")), name="proposal_line_rate_nonnegative"),
            models.CheckConstraint(condition=models.Q(currency="USD"), name="proposal_line_currency_usd_only"),
            models.CheckConstraint(condition=models.Q(unit_of_measure__in=["HOUR", "PROJECT", "DELIVERABLE"]), name="proposal_line_unit_allowed"),
        ]

    @property
    def line_total(self) -> Decimal:
        return (self.quantity * self.unit_rate).quantize(Decimal("0.01"))

    def clean(self):
        errors = {}
        if self.source_service_id and self.proposal_id and self.source_service.workspace_id != self.proposal.workspace_id:
            errors["source_service"] = "Service must belong to the proposal workspace."
        if self.proposal_id and self.proposal.status != Proposal.Status.DRAFT:
            errors["proposal"] = "Proposal lines are immutable after sending."
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        if not self._state.adding and not _service_write_is_authorized():
            raise ValidationError("Persisted proposal lines may only be changed by proposal domain services.")
        self.full_clean()
        return super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        if not _service_write_is_authorized():
            raise ValidationError("Persisted proposal lines may only be deleted by proposal domain services.")
        return super().delete(*args, **kwargs)
