from contextlib import contextmanager
from contextvars import ContextVar

from django.db import models

from workspaces.models import Membership


class InterfacePreferenceWriteBoundaryViolation(ValueError):
    """Raised when preference persistence bypasses the domain service."""


_interface_preference_write_authorized = ContextVar(
    "interface_preference_write_authorized",
    default=False,
)


@contextmanager
def allow_interface_preference_writes():
    """Permit the preference service to persist a membership-owned profile."""
    token = _interface_preference_write_authorized.set(True)
    try:
        yield
    finally:
        _interface_preference_write_authorized.reset(token)


class MembershipInterfacePreferenceQuerySet(models.QuerySet):
    def _require_write_boundary(self):
        if not _interface_preference_write_authorized.get():
            raise InterfacePreferenceWriteBoundaryViolation(
                "Interface preference writes must use the preference services."
            )

    def update(self, **kwargs):
        self._require_write_boundary()
        return super().update(**kwargs)

    def bulk_update(self, objs, fields, batch_size=None):
        self._require_write_boundary()
        return super().bulk_update(objs, fields, batch_size=batch_size)

    def bulk_create(self, objs, batch_size=None, ignore_conflicts=False, update_conflicts=False, update_fields=None, unique_fields=None):
        self._require_write_boundary()
        return super().bulk_create(objs, batch_size=batch_size, ignore_conflicts=ignore_conflicts, update_conflicts=update_conflicts, update_fields=update_fields, unique_fields=unique_fields)

    def delete(self):
        self._require_write_boundary()
        return super().delete()


class MembershipInterfacePreferenceManager(
    models.Manager.from_queryset(MembershipInterfacePreferenceQuerySet)
):
    pass


class MembershipInterfacePreference(models.Model):
    """Personal interface state owned by one workspace membership."""

    owner = models.OneToOneField(
        Membership,
        on_delete=models.CASCADE,
        related_name="interface_preferences",
    )
    sidebar_collapsed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = MembershipInterfacePreferenceManager()

    class Meta:
        base_manager_name = "objects"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(sidebar_collapsed__in=[True, False]),
                name="membership_interface_preference_sidebar_collapsed_boolean",
            )
        ]

    def save(self, *args, **kwargs):
        if not _interface_preference_write_authorized.get():
            raise InterfacePreferenceWriteBoundaryViolation(
                "Interface preference writes must use the preference services."
            )
        return super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        if not _interface_preference_write_authorized.get():
            raise InterfacePreferenceWriteBoundaryViolation(
                "Interface preference writes must use the preference services."
            )
        return super().delete(*args, **kwargs)
