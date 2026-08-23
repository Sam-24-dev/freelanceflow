import uuid
from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from categories.models import Category
from clients.models import Client
from projects.models import Project
from workspaces.models import Workspace

CENT = Decimal("0.01")


class LedgerQuerySet(models.QuerySet):
    def for_workspace(self, workspace):
        return self.filter(workspace=workspace)

    def update(self, **kwargs):
        raise ValidationError("Ledger entries are immutable.")

    def delete(self):
        raise ValidationError("Ledger entries cannot be deleted.")

    def bulk_update(self, *args, **kwargs):
        raise ValidationError("Ledger entries are immutable.")


class LedgerEntry(models.Model):
    class Direction(models.TextChoices):
        INCOME = "INCOME", "Income"
        EXPENSE = "EXPENSE", "Expense"

    class Source(models.TextChoices):
        MANUAL = "MANUAL", "Manual"
        REVERSAL = "REVERSAL", "Reversal"

    workspace = models.ForeignKey(Workspace, on_delete=models.PROTECT, related_name="ledger_entries")
    public_id = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    idempotency_key = models.UUIDField()
    fingerprint = models.CharField(max_length=64, editable=False)
    direction = models.CharField(max_length=7, choices=Direction.choices)
    source = models.CharField(max_length=8, choices=Source.choices, default=Source.MANUAL)
    amount = models.DecimalField(max_digits=18, decimal_places=2)
    currency = models.CharField(max_length=3, default="USD")
    occurred_on = models.DateField()
    description = models.CharField(max_length=500)
    category = models.ForeignKey(Category, on_delete=models.PROTECT, null=True, blank=True, related_name="ledger_entries")
    category_name_snapshot = models.CharField(max_length=255, blank=True)
    category_deductible_snapshot = models.BooleanField(null=True, blank=True)
    client = models.ForeignKey(Client, on_delete=models.PROTECT, null=True, blank=True, related_name="ledger_entries")
    project = models.ForeignKey(Project, on_delete=models.PROTECT, null=True, blank=True, related_name="ledger_entries")
    reversal_of = models.OneToOneField("self", on_delete=models.PROTECT, null=True, blank=True, related_name="reversal")
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="ledger_entries")
    created_at = models.DateTimeField(auto_now_add=True)

    objects = LedgerQuerySet.as_manager()

    class Meta:
        base_manager_name = "objects"
        constraints = [
            models.UniqueConstraint(fields=["workspace", "idempotency_key"], name="ledger_workspace_idempotency_unique"),
            models.CheckConstraint(condition=models.Q(direction__in=["INCOME", "EXPENSE"]), name="ledger_direction_allowed"),
            models.CheckConstraint(condition=models.Q(source__in=["MANUAL", "REVERSAL"]), name="ledger_source_allowed"),
            models.CheckConstraint(condition=models.Q(amount__gt=Decimal("0.00")), name="ledger_amount_positive"),
            models.CheckConstraint(condition=models.Q(currency="USD"), name="ledger_currency_usd"),
            models.CheckConstraint(condition=models.Q(description__gt=""), name="ledger_description_nonempty"),
            models.CheckConstraint(condition=models.Q(source="REVERSAL") | models.Q(source="MANUAL", reversal_of__isnull=True), name="ledger_reversal_source_consistent"),
            models.CheckConstraint(condition=models.Q(source="REVERSAL", reversal_of__isnull=False) | models.Q(source="MANUAL"), name="ledger_reversal_reference_consistent"),
            models.CheckConstraint(condition=models.Q(source="REVERSAL") | models.Q(source="MANUAL", direction="EXPENSE", category__isnull=False, category_name_snapshot__gt="", category_deductible_snapshot__isnull=False) | models.Q(source="MANUAL", direction="INCOME", category__isnull=True, category_name_snapshot="", category_deductible_snapshot__isnull=True), name="ledger_manual_category_consistent"),
        ]

    def full_clean(self, *args, **kwargs):
        self.description = " ".join(self.description.split())
        return super().full_clean(*args, **kwargs)

    def clean(self):
        errors = {}
        if self.amount is None or self.amount <= 0 or self.amount != self.amount.quantize(CENT):
            errors["amount"] = "Amount must be positive exact cents."
        if self.currency != "USD":
            errors["currency"] = "Ledger entries use USD only."
        if not self.description:
            errors["description"] = "Description is required."
        if self.client_id and self.client.workspace_id != self.workspace_id:
            errors["client"] = "Client must belong to the workspace."
        if self.project_id and (self.project.workspace_id != self.workspace_id or not self.client_id or self.project.client_id != self.client_id):
            errors["project"] = "Project must belong to the workspace and client."
        if self.source == self.Source.MANUAL:
            self._validate_manual_category(errors)
        elif self.reversal_of_id:
            self._validate_reversal(errors)
        if errors:
            raise ValidationError(errors)

    def _validate_manual_category(self, errors):
        if self.direction == self.Direction.INCOME:
            if self.category_id or self.category_name_snapshot or self.category_deductible_snapshot is not None:
                errors["category"] = "Manual income cannot carry category facts."
        elif not self.category_id or self.category.workspace_id != self.workspace_id or self.category.status != Category.Status.ACTIVE or self.category_name_snapshot != self.category.name or self.category_deductible_snapshot != self.category.default_deductible:
            errors["category"] = "Manual expenses require active, matching category facts."

    def _validate_reversal(self, errors):
        original = self.reversal_of
        fields = ("category_id", "category_name_snapshot", "category_deductible_snapshot", "client_id", "project_id")
        if original.source != self.Source.MANUAL or original.workspace_id != self.workspace_id or original.amount != self.amount or original.direction == self.direction or any(getattr(original, field) != getattr(self, field) for field in fields):
            errors["reversal_of"] = "Reversal must fully mirror one manual entry except direction."

    def save(self, *args, **kwargs):
        if not self._state.adding:
            raise ValidationError("Ledger entries are immutable.")
        self.full_clean()
        return super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError("Ledger entries cannot be deleted.")
