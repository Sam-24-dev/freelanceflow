import uuid
from contextlib import contextmanager
from contextvars import ContextVar

from django.conf import settings
from django.db import models


class MembershipWriteBoundaryViolation(ValueError):
    """Raised when membership role or deletion bypasses the domain services."""


_membership_write_authorized = ContextVar("membership_write_authorized", default=False)


@contextmanager
def allow_membership_writes():
    """Permit the transactional domain services to mutate an existing membership."""
    token = _membership_write_authorized.set(True)
    try:
        yield
    finally:
        _membership_write_authorized.reset(token)


class MembershipQuerySet(models.QuerySet):
    def update(self, **kwargs):
        if not _membership_write_authorized.get():
            raise MembershipWriteBoundaryViolation(
                "Membership updates must use the membership services."
            )
        return super().update(**kwargs)

    def bulk_update(self, objs, fields, batch_size=None):
        if not _membership_write_authorized.get():
            raise MembershipWriteBoundaryViolation(
                "Membership updates must use the membership services."
            )
        return super().bulk_update(objs, fields, batch_size=batch_size)

    def delete(self):
        if not _membership_write_authorized.get():
            raise MembershipWriteBoundaryViolation(
                "Membership deletion must use the membership services."
            )
        return super().delete()


class MembershipManager(models.Manager.from_queryset(MembershipQuerySet)):
    pass


class Workspace(models.Model):
    """Tenant boundary for a group of collaborating users."""

    public_id = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=100, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class Membership(models.Model):
    """A user's role within one workspace."""

    class Role(models.TextChoices):
        OWNER = "OWNER", "Owner"
        ADMINISTRATIVE = "ADMINISTRATIVE", "Administrative"
        OPERATIONAL = "OPERATIONAL", "Operational"

    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.CASCADE,
        related_name="memberships",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="workspace_memberships",
    )
    role = models.CharField(max_length=20, choices=Role.choices)

    objects = MembershipManager()

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["workspace", "user"],
                name="unique_membership_per_workspace_user",
            )
        ]

    def __str__(self) -> str:
        return f"{self.user} in {self.workspace}"

    def save(self, *args, **kwargs):
        if not self._state.adding and not _membership_write_authorized.get():
            raise MembershipWriteBoundaryViolation(
                "Membership updates must use the membership services."
            )
        return super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        if not _membership_write_authorized.get():
            raise MembershipWriteBoundaryViolation(
                "Membership deletion must use the membership services."
            )
        return super().delete(*args, **kwargs)
