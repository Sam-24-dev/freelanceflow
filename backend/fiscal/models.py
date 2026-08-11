import uuid
from contextlib import contextmanager
from contextvars import ContextVar
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import models

from workspaces.models import Workspace


_fiscal_service_write_depth = ContextVar("fiscal_service_write_depth", default=0)


@contextmanager
def _fiscal_service_write_boundary():
    """Coordinate fiscal service writes in this Python process only.

    This is not a security boundary. Database constraints and triggers protect
    persisted fiscal history from direct SQL mutation.
    """
    token = _fiscal_service_write_depth.set(_fiscal_service_write_depth.get() + 1)
    try:
        yield
    finally:
        _fiscal_service_write_depth.reset(token)


def _service_write_is_authorized() -> bool:
    return _fiscal_service_write_depth.get() > 0


class FiscalConfigurationQuerySet(models.QuerySet):
    def for_workspace(self, workspace: Workspace):
        return self.filter(workspace=workspace)

    def create(self, **kwargs):
        if not _service_write_is_authorized():
            raise ValidationError("Fiscal configurations may only be created by fiscal domain services.")
        return super().create(**kwargs)

    def update(self, **kwargs):
        raise ValidationError("Fiscal configurations are immutable.")

    def bulk_create(self, objs, batch_size=None, ignore_conflicts=False, update_conflicts=False, update_fields=None, unique_fields=None):
        raise ValidationError("Fiscal configurations may only be created by fiscal domain services.")

    def bulk_update(self, objs, fields, batch_size=None):
        raise ValidationError("Fiscal configurations are immutable.")

    def delete(self):
        raise ValidationError("Fiscal configurations are immutable.")


class FiscalConfiguration(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.PROTECT, related_name="fiscal_configurations")
    public_id = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    version = models.PositiveIntegerField()
    legal_name = models.CharField(max_length=255)
    tax_identifier = models.CharField(max_length=100)
    tax_regime = models.CharField(max_length=100)
    applies_vat = models.BooleanField()
    vat_rate = models.DecimalField(max_digits=5, decimal_places=2)
    withholding_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0.00"))
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = FiscalConfigurationQuerySet.as_manager()

    class Meta:
        base_manager_name = "objects"
        constraints = [
            models.UniqueConstraint(fields=("workspace", "version"), name="fiscal_configuration_workspace_version_unique"),
            models.CheckConstraint(condition=models.Q(version__gt=0), name="fiscal_configuration_version_positive"),
            models.CheckConstraint(
                condition=(
                    models.Q(vat_rate__gte=Decimal("0.00"), vat_rate__lte=Decimal("100.00"))
                    & models.Q(withholding_rate__gte=Decimal("0.00"), withholding_rate__lte=Decimal("100.00"))
                ),
                name="fiscal_configuration_rates_in_range",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(applies_vat=False, vat_rate=Decimal("0.00"))
                    | models.Q(applies_vat=True, vat_rate__gt=Decimal("0.00"))
                ),
                name="fiscal_configuration_vat_consistent",
            ),
        ]

    def clean(self):
        errors = {}
        if self.version is not None and self.version <= 0:
            errors["version"] = "Version must be positive."
        for field in ("vat_rate", "withholding_rate"):
            value = getattr(self, field)
            if value is not None and not Decimal("0.00") <= value <= Decimal("100.00"):
                errors[field] = "Rate must be between 0.00 and 100.00."
        if self.applies_vat and self.vat_rate is not None and self.vat_rate <= Decimal("0.00"):
            errors["vat_rate"] = "VAT rate must be positive when VAT applies."
        if not self.applies_vat and self.vat_rate not in (None, Decimal("0.00")):
            errors["vat_rate"] = "VAT rate must be zero when VAT does not apply."
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        if not _service_write_is_authorized():
            if self._state.adding:
                raise ValidationError("Fiscal configurations may only be created by fiscal domain services.")
            raise ValidationError("Fiscal configurations are immutable.")
        self.full_clean()
        return super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError("Fiscal configurations are immutable.")
