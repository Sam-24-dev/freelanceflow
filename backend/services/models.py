import uuid
from decimal import Decimal

from django.core.validators import MinValueValidator
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from workspaces.models import Workspace


class ServiceQuerySet(models.QuerySet):
    def for_workspace(self, workspace: Workspace):
        return self.filter(workspace=workspace)


class Service(models.Model):
    class UnitOfMeasure(models.TextChoices):
        HOUR = "HOUR", "Hour"
        PROJECT = "PROJECT", "Project"
        DELIVERABLE = "DELIVERABLE", "Deliverable"

    class Currency(models.TextChoices):
        USD = "USD", "US Dollar"

    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", "Active"
        ARCHIVED = "ARCHIVED", "Archived"

    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.PROTECT,
        related_name="services",
    )
    public_id = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    name = models.CharField(max_length=255)
    name_normalized = models.CharField(max_length=255, editable=False)
    description = models.TextField(blank=True)
    unit_of_measure = models.CharField(max_length=20, choices=UnitOfMeasure.choices)
    rate = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    currency = models.CharField(
        max_length=3,
        choices=Currency.choices,
        default=Currency.USD,
    )
    status = models.CharField(
        max_length=10,
        choices=Status.choices,
        default=Status.ACTIVE,
    )
    archived_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = ServiceQuerySet.as_manager()

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["workspace", "name_normalized"],
                name="unique_service_name_per_workspace",
            ),
            models.CheckConstraint(
                condition=models.Q(rate__gte=Decimal("0.00")),
                name="service_rate_nonnegative",
            ),
            models.CheckConstraint(
                condition=models.Q(currency="USD"),
                name="service_currency_usd_only",
            ),
            models.CheckConstraint(
                condition=models.Q(
                    unit_of_measure__in=["HOUR", "PROJECT", "DELIVERABLE"]
                ),
                name="service_unit_of_measure_allowed",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(status="ACTIVE", archived_at__isnull=True)
                    | models.Q(status="ARCHIVED", archived_at__isnull=False)
                ),
                name="service_status_archived_at_consistent",
            ),
        ]

    def __str__(self) -> str:
        return self.name

    def full_clean(self, *args, **kwargs):
        self._normalize_fields()
        return super().full_clean(*args, **kwargs)

    def clean(self):
        errors = {}

        if self.status == self.Status.ACTIVE and self.archived_at is not None:
            errors["archived_at"] = "Active services cannot have an archive timestamp."
        elif self.status == self.Status.ARCHIVED and self.archived_at is None:
            errors["archived_at"] = "Archived services require an archive timestamp."

        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    def archive(self):
        self.status = self.Status.ARCHIVED
        self.archived_at = timezone.now()
        self.save(update_fields=["status", "archived_at", "updated_at"])

    def restore(self):
        self.status = self.Status.ACTIVE
        self.archived_at = None
        self.save(update_fields=["status", "archived_at", "updated_at"])

    def _normalize_fields(self):
        self.name = self._collapse_whitespace(self.name)
        self.name_normalized = self.name.casefold()
        self.description = self._collapse_whitespace(self.description)

    @staticmethod
    def _collapse_whitespace(value: str) -> str:
        return " ".join(value.split())