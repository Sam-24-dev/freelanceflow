import re
import uuid

from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from workspaces.models import Workspace


class ClientQuerySet(models.QuerySet):
    def for_workspace(self, workspace: Workspace):
        return self.filter(workspace=workspace)


class Client(models.Model):
    class ClientType(models.TextChoices):
        COMPANY = "COMPANY", "Company"
        INDIVIDUAL = "INDIVIDUAL", "Individual"

    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", "Active"
        ARCHIVED = "ARCHIVED", "Archived"

    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.PROTECT,
        related_name="clients",
    )
    public_id = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    legal_name = models.CharField(max_length=255)
    client_type = models.CharField(max_length=20, choices=ClientType.choices)
    tax_identifier = models.CharField(max_length=64)
    tax_identifier_normalized = models.CharField(max_length=64, editable=False)
    primary_contact_name = models.CharField(max_length=255)
    primary_contact_email = models.EmailField()
    primary_contact_phone = models.CharField(max_length=15, blank=True)
    address = models.TextField(blank=True)
    status = models.CharField(
        max_length=10,
        choices=Status.choices,
        default=Status.ACTIVE,
    )
    archived_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = ClientQuerySet.as_manager()

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["workspace", "tax_identifier_normalized"],
                name="unique_client_tax_identifier_per_workspace",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(status="ACTIVE", archived_at__isnull=True)
                    | models.Q(status="ARCHIVED", archived_at__isnull=False)
                ),
                name="client_status_archived_at_consistent",
            ),
        ]

    def __str__(self) -> str:
        return self.legal_name

    def full_clean(self, *args, **kwargs):
        self._normalize_fields()
        return super().full_clean(*args, **kwargs)

    def clean(self):
        errors = {}

        if not self.tax_identifier_normalized:
            errors["tax_identifier"] = "Tax identifier must contain letters or digits."
        elif not re.fullmatch(r"[a-z0-9]+", self.tax_identifier_normalized):
            errors["tax_identifier"] = "Tax identifier contains invalid characters."

        if self.primary_contact_phone and (
            not self.primary_contact_phone.isdigit()
            or not 7 <= len(self.primary_contact_phone) <= 15
        ):
            errors["primary_contact_phone"] = (
                "Primary contact phone must contain 7 to 15 digits."
            )

        if self.status == self.Status.ACTIVE and self.archived_at is not None:
            errors["archived_at"] = "Active clients cannot have an archive timestamp."
        elif self.status == self.Status.ARCHIVED and self.archived_at is None:
            errors["archived_at"] = "Archived clients require an archive timestamp."

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
        self.legal_name = self._collapse_whitespace(self.legal_name)
        self.tax_identifier = self._collapse_whitespace(self.tax_identifier)
        self.tax_identifier_normalized = re.sub(
            r"[ .\-/]", "", self.tax_identifier
        ).casefold()
        self.primary_contact_name = self._collapse_whitespace(self.primary_contact_name)
        self.primary_contact_email = self.primary_contact_email.strip().lower()
        self.primary_contact_phone = self.primary_contact_phone.strip()
        self.address = self._collapse_whitespace(self.address)

    @staticmethod
    def _collapse_whitespace(value: str) -> str:
        return " ".join(value.split())