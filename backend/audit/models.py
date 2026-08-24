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

class AuditEventWorkspaceRequired(ValueError):
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
    _audit_workspace_id = None

    def _clone(self):
        clone = super()._clone()
        clone._audit_workspace_id = self._audit_workspace_id
        return clone

    def for_workspace(self, workspace):
        if not isinstance(workspace, Workspace) or workspace.pk is None:
            raise AuditEventWorkspaceRequired("Audit event reads require a saved Workspace.")
        queryset = self.filter(workspace=workspace)
        queryset._audit_workspace_id = workspace.pk
        return queryset

    def _require_workspace(self):
        if self._audit_workspace_id is None:
            raise AuditEventWorkspaceRequired("Audit event reads require AuditEvent.objects.for_workspace(workspace).")

    def _require_same_workspace(self, other):
        self._require_workspace()
        if not isinstance(other, AuditEventQuerySet) or other._audit_workspace_id != self._audit_workspace_id:
            raise AuditEventWorkspaceRequired("Audit event querysets may only be combined within one workspace.")

    def _fetch_all(self):
        self._require_workspace()
        return super()._fetch_all()
    def aggregate(self, *args, **kwargs):
        self._require_workspace()
        return super().aggregate(*args, **kwargs)
    async def aaggregate(self, *args, **kwargs):
        self._require_workspace()
        return await super().aaggregate(*args, **kwargs)
    def count(self):
        self._require_workspace()
        return super().count()
    async def acount(self):
        self._require_workspace()
        return await super().acount()
    def exists(self):
        self._require_workspace()
        return super().exists()
    async def aexists(self):
        self._require_workspace()
        return await super().aexists()
    def contains(self, obj):
        self._require_workspace()
        return super().contains(obj)
    async def acontains(self, obj):
        self._require_workspace()
        return await super().acontains(obj)
    def iterator(self, *args, **kwargs):
        self._require_workspace()
        return super().iterator(*args, **kwargs)
    async def aiterator(self, *args, **kwargs):
        self._require_workspace()
        async for item in super().aiterator(*args, **kwargs):
            yield item
    def explain(self, *args, **kwargs):
        self._require_workspace()
        return super().explain(*args, **kwargs)

    def __and__(self, other):
        self._require_same_workspace(other)
        return super().__and__(other)
    def __or__(self, other):
        self._require_same_workspace(other)
        return super().__or__(other)
    def __xor__(self, other):
        self._require_same_workspace(other)
        return super().__xor__(other)
    def _combinator_query(self, combinator, *other_qs, all=False):
        self._require_workspace()
        for other in other_qs:
            self._require_same_workspace(other)
        return super()._combinator_query(combinator, *other_qs, all=all)

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
    def all(self):
        raise AuditEventWorkspaceRequired("Audit event reads require AuditEvent.objects.for_workspace(workspace).")
    def for_workspace(self, workspace):
        return self.get_queryset().for_workspace(workspace)
    def raw(self, *args, **kwargs):
        raise AuditEventWorkspaceRequired("Raw audit event reads are not a public API; use for_workspace(workspace).")

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
    # Django's internal relation collector needs this unguarded base manager.
    # It is not a security boundary; services authorize public reads.
    _base_objects = models.Manager()
    objects = AuditEventManager()

    class Meta:
        base_manager_name = "_base_objects"
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
