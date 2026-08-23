import uuid
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models

from workspaces.models import Workspace


class CategoryQuerySet(models.QuerySet):
    def for_workspace(self, workspace: Workspace):
        return self.filter(workspace=workspace)

    def selectable(self):
        return self.filter(status=Category.Status.ACTIVE)

    def update(self, **kwargs):
        raise ValidationError("Category updates must use category domain services.")

    def bulk_update(self, objs, fields, batch_size=None):
        raise ValidationError("Category updates must use category domain services.")

    def delete(self):
        raise ValidationError("Categories cannot be deleted.")


class Category(models.Model):
    """A tenant-scoped expense classification with a soft lifecycle."""

    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", "Active"
        INACTIVE = "INACTIVE", "Inactive"

    workspace = models.ForeignKey(Workspace, on_delete=models.PROTECT, related_name="categories")
    public_id = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    name = models.CharField(max_length=255)
    name_normalized = models.CharField(max_length=255, editable=False)
    description = models.TextField(blank=True)
    default_deductible = models.BooleanField(default=False)
    monthly_budget = models.DecimalField(max_digits=18, decimal_places=2, null=True, blank=True, validators=[MinValueValidator(Decimal("0.00"))])
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.ACTIVE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = CategoryQuerySet.as_manager()

    class Meta:
        base_manager_name = "objects"
        ordering = ["name", "id"]
        constraints = [
            models.UniqueConstraint(fields=["workspace", "name_normalized"], name="category_workspace_normalized_name_unique"),
            models.CheckConstraint(condition=models.Q(monthly_budget__isnull=True) | models.Q(monthly_budget__gte=Decimal("0.00")), name="category_monthly_budget_nonnegative"),
            models.CheckConstraint(condition=models.Q(status__in=["ACTIVE", "INACTIVE"]), name="category_status_allowed"),
            models.CheckConstraint(condition=models.Q(default_deductible__in=[True, False]), name="category_default_deductible_boolean"),
            models.CheckConstraint(condition=models.Q(name__gt=""), name="category_name_nonempty"),
            models.CheckConstraint(condition=models.Q(name_normalized__gt=""), name="category_name_normalized_nonempty"),
        ]

    def __str__(self) -> str:
        return self.name

    def full_clean(self, *args, **kwargs):
        self._normalize_fields()
        return super().full_clean(*args, **kwargs)

    def clean(self):
        errors = {}
        if not self.name:
            errors["name"] = "A category name is required."
        if self.monthly_budget is not None and self.monthly_budget < Decimal("0.00"):
            errors["monthly_budget"] = "Monthly budget cannot be negative."
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError("Categories cannot be deleted.")

    def _normalize_fields(self):
        self.name = self._collapse_whitespace(self.name)
        self.name_normalized = self.name.lower()
        self.description = self._collapse_whitespace(self.description)

    @staticmethod
    def _collapse_whitespace(value: str) -> str:
        return " ".join(value.split())
