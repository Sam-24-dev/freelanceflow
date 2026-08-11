import uuid
from contextlib import contextmanager
from contextvars import ContextVar

from django.core.exceptions import ValidationError
from django.db import models

from clients.models import Client
from proposals.models import Proposal
from workspaces.models import Workspace


_project_write_depth = ContextVar("project_service_write_depth", default=0)


@contextmanager
def _project_service_write_boundary():
    """Coordinate project service writes in this Python process only.

    This is not a security boundary: MySQL constraints and triggers provide the
    durable protection against direct database writes.
    """
    token = _project_write_depth.set(_project_write_depth.get() + 1)
    try:
        yield
    finally:
        _project_write_depth.reset(token)


def _service_write_is_authorized() -> bool:
    return _project_write_depth.get() > 0


class ProjectQuerySet(models.QuerySet):
    def for_workspace(self, workspace: Workspace):
        return self.filter(workspace=workspace)

    def create(self, **kwargs):
        if not _service_write_is_authorized():
            raise ValidationError("Projects may only be created by project domain services.")
        return super().create(**kwargs)

    def update(self, **kwargs):
        if not _service_write_is_authorized():
            raise ValidationError("Projects may only be changed by project domain services.")
        return super().update(**kwargs)

    def bulk_create(self, objs, batch_size=None, ignore_conflicts=False, update_conflicts=False, update_fields=None, unique_fields=None):
        if not _service_write_is_authorized():
            raise ValidationError("Projects may only be created by project domain services.")
        return super().bulk_create(objs, batch_size=batch_size, ignore_conflicts=ignore_conflicts,
                                   update_conflicts=update_conflicts, update_fields=update_fields,
                                   unique_fields=unique_fields)

    def bulk_update(self, objs, fields, batch_size=None):
        if not _service_write_is_authorized():
            raise ValidationError("Projects may only be changed by project domain services.")
        return super().bulk_update(objs, fields, batch_size=batch_size)

    def delete(self):
        raise ValidationError("Projects cannot be deleted.")


class Project(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", "Active"
        COMPLETED = "COMPLETED", "Completed"
        CANCELLED = "CANCELLED", "Cancelled"

    workspace = models.ForeignKey(Workspace, on_delete=models.PROTECT, related_name="projects")
    client = models.ForeignKey(Client, on_delete=models.PROTECT, related_name="projects")
    proposal = models.OneToOneField(Proposal, on_delete=models.PROTECT, related_name="project")
    public_id = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.ACTIVE)
    completed_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    archived_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = ProjectQuerySet.as_manager()

    class Meta:
        base_manager_name = "objects"
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(status="ACTIVE", completed_at__isnull=True, cancelled_at__isnull=True, archived_at__isnull=True)
                    | models.Q(status="COMPLETED", completed_at__isnull=False, cancelled_at__isnull=True)
                    | models.Q(status="CANCELLED", completed_at__isnull=True, cancelled_at__isnull=False)
                ),
                name="project_status_timestamps_archive_consistent",
            ),
        ]

    def clean(self):
        errors = {}
        if self.proposal_id:
            if self.workspace_id != self.proposal.workspace_id:
                errors["workspace"] = "Project workspace must match its proposal."
            if self.client_id != self.proposal.client_id:
                errors["client"] = "Project client must match its proposal."
        if not self._state.adding:
            current = type(self).objects.get(pk=self.pk)
            if any(getattr(current, field) != getattr(self, field) for field in ("workspace_id", "client_id", "proposal_id")):
                errors["__all__"] = "Project origin is immutable."
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        if not _service_write_is_authorized():
            if self._state.adding:
                raise ValidationError("Projects may only be created by project domain services.")
            raise ValidationError("Persisted projects may only be changed by project domain services.")
        self.full_clean()
        return super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError("Projects cannot be deleted.")
