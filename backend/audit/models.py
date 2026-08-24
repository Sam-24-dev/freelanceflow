from contextlib import contextmanager
from contextvars import ContextVar
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import F, Q
from workspaces.models import Membership, Workspace

_audit_write_depth = ContextVar("audit_write_depth", default=0)

class AuditEventWriteBoundaryViolation(ValueError):
    pass

@contextmanager
def audit_event_write_boundary():
    token = _audit_write_depth.set(_audit_write_depth.get() + 1)
    try:
        yield
    finally:
        _audit_write_depth.reset(token)

def _audit_write_is_authorized():
    return _audit_write_depth.get() > 0

class AuditEventQuerySet(models.QuerySet):
    def for_workspace(self, workspace):
        return self.filter(workspace=workspace)
    def create(self, **kwargs):
        if not _audit_write_is_authorized():
            raise AuditEventWriteBoundaryViolation("Audit events may only be appended by audited domain services.")
        return super().create(**kwargs)
    def update(self, **kwargs):
        raise AuditEventWriteBoundaryViolation("Audit events are immutable.")
    def bulk_create(self, objs, batch_size=None, ignore_conflicts=False, update_conflicts=False, update_fields=None, unique_fields=None):
        raise AuditEventWriteBoundaryViolation("Audit events may only be appended by audited domain services.")
    def bulk_update(self, objs, fields, batch_size=None):
        raise AuditEventWriteBoundaryViolation("Audit events are immutable.")
    def delete(self):
        raise AuditEventWriteBoundaryViolation("Audit events are immutable.")

class AuditEventManager(models.Manager.from_queryset(AuditEventQuerySet)):
    pass

class AuditEvent(models.Model):
    class EventType(models.TextChoices):
        WORKSPACE_CREATED = "workspace.created", "Workspace created"
        MEMBERSHIP_ROLE_CHANGED = "membership.role_changed", "Membership role changed"
        MEMBERSHIP_REMOVED = "membership.removed", "Membership removed"
    workspace = models.ForeignKey(Workspace, on_delete=models.PROTECT, related_name="audit_events")
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="audit_events")
    event_type = models.CharField(max_length=32, choices=EventType.choices)
    target_membership_id = models.PositiveBigIntegerField()
    role_before = models.CharField(max_length=20, choices=Membership.Role.choices, null=True, blank=True)
    role_after = models.CharField(max_length=20, choices=Membership.Role.choices, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    objects = AuditEventManager()

    class Meta:
        base_manager_name = "objects"
        ordering = ["-created_at", "-pk"]
        constraints = [
            models.CheckConstraint(condition=Q(target_membership_id__gt=0), name="audit_event_target_membership_positive"),
            models.CheckConstraint(condition=(Q(event_type="workspace.created", role_before__isnull=True, role_after="OWNER") | Q(event_type="membership.role_changed", role_before__isnull=False, role_after__isnull=False) | Q(event_type="membership.removed", role_before__isnull=False, role_after__isnull=True)), name="audit_event_snapshot_shape_valid"),
            models.CheckConstraint(condition=(~Q(event_type="membership.role_changed") | ~Q(role_before=F("role_after"))), name="audit_event_role_change_has_difference"),
        ]

    def clean(self):
        errors = {}
        if self.target_membership_id is not None and self.target_membership_id <= 0:
            errors["target_membership_id"] = "Target membership ID must be positive."
        if self.event_type == self.EventType.WORKSPACE_CREATED:
            if self.role_before is not None or self.role_after != Membership.Role.OWNER: errors["event_type"] = "Workspace creation requires an owner snapshot."
        elif self.event_type == self.EventType.MEMBERSHIP_ROLE_CHANGED:
            if self.role_before is None or self.role_after is None or self.role_before == self.role_after: errors["event_type"] = "Role changes require different before and after roles."
        elif self.event_type == self.EventType.MEMBERSHIP_REMOVED:
            if self.role_before is None or self.role_after is not None: errors["event_type"] = "Membership removal requires only a before role."
        if errors: raise ValidationError(errors)

    def save(self, *args, **kwargs):
        if not self._state.adding: raise AuditEventWriteBoundaryViolation("Audit events are immutable.")
        if not _audit_write_is_authorized(): raise AuditEventWriteBoundaryViolation("Audit events may only be appended by audited domain services.")
        self.full_clean()
        return super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise AuditEventWriteBoundaryViolation("Audit events are immutable.")