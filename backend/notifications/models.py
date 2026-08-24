import uuid
from contextlib import contextmanager
from contextvars import ContextVar

from django.core.exceptions import ValidationError
from django.db import models

from payments.models import Payment
from workspaces.models import Membership, Workspace


_notification_write_depth = ContextVar("notification_write_depth", default=0)


class NotificationWriteBoundaryViolation(ValueError):
    """Raised when notification writes bypass the notification service boundary."""


@contextmanager
def notification_write_boundary():
    """Internal same-process guard; MySQL triggers remain the durable boundary."""
    token = _notification_write_depth.set(_notification_write_depth.get() + 1)
    try:
        yield
    finally:
        _notification_write_depth.reset(token)


def _writes_allowed():
    return _notification_write_depth.get() > 0


class NotificationQuerySet(models.QuerySet):
    def create(self, **kwargs):
        if not _writes_allowed():
            raise NotificationWriteBoundaryViolation("Notifications require the notification service boundary.")
        return super().create(**kwargs)

    def bulk_create(self, objs, **kwargs):
        if not _writes_allowed():
            raise NotificationWriteBoundaryViolation("Notifications require the notification service boundary.")
        for notification in objs:
            notification.full_clean()
        return super().bulk_create(objs, **kwargs)

    def update(self, **kwargs):
        raise NotificationWriteBoundaryViolation("Notification lifecycle changes must use instance save().")

    def bulk_update(self, objs, fields, batch_size=None):
        raise NotificationWriteBoundaryViolation("Notification lifecycle changes must use instance save().")

    def delete(self):
        raise NotificationWriteBoundaryViolation("Notifications are retained until recipient deletion.")


class NotificationManager(models.Manager.from_queryset(NotificationQuerySet)):
    pass


class InAppNotification(models.Model):
    """Recipient-scoped immutable payment notification with a one-way lifecycle."""

    class Kind(models.TextChoices):
        PAYMENT_RECORDED = "payment.recorded", "Payment recorded"

    class State(models.TextChoices):
        UNREAD = "UNREAD", "Unread"
        READ = "READ", "Read"
        ARCHIVED = "ARCHIVED", "Archived"

    public_id = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    workspace = models.ForeignKey(Workspace, on_delete=models.PROTECT, related_name="notifications")
    recipient = models.ForeignKey(Membership, on_delete=models.DO_NOTHING, db_constraint=False, related_name="notifications")
    source_payment = models.ForeignKey(Payment, on_delete=models.PROTECT, related_name="notifications")
    kind = models.CharField(max_length=32, choices=Kind.choices, default=Kind.PAYMENT_RECORDED)
    state = models.CharField(max_length=10, choices=State.choices, default=State.UNREAD)
    read_at = models.DateTimeField(null=True, blank=True)
    archived_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    objects = NotificationManager()

    class Meta:
        base_manager_name = "objects"
        constraints = [
            models.UniqueConstraint(fields=("source_payment", "recipient"), name="notification_source_payment_recipient_unique"),
            models.CheckConstraint(condition=models.Q(state__in=["UNREAD", "READ", "ARCHIVED"]), name="notification_supported_state"),
            models.CheckConstraint(
                condition=(
                    models.Q(state="UNREAD", read_at__isnull=True, archived_at__isnull=True)
                    | models.Q(state="READ", read_at__isnull=False, archived_at__isnull=True)
                    | models.Q(state="ARCHIVED", read_at__isnull=False, archived_at__isnull=False)
                ),
                name="notification_timestamp_shape",
            ),
            models.CheckConstraint(condition=models.Q(kind="payment.recorded"), name="notification_kind_fixed"),
        ]
        indexes = [models.Index(fields=("recipient", "state", "created_at"), name="notif_recipient_state_created")]

    def clean(self):
        errors = {}
        if self.kind != self.Kind.PAYMENT_RECORDED:
            errors["kind"] = "Only payment.recorded notifications are supported."
        timestamps = {
            self.State.UNREAD: self.read_at is None and self.archived_at is None,
            self.State.READ: self.read_at is not None and self.archived_at is None,
            self.State.ARCHIVED: self.read_at is not None and self.archived_at is not None,
        }
        if not timestamps.get(self.state, False):
            errors["state"] = "Notification state and timestamps are inconsistent."
        if self.recipient_id and self.workspace_id != self.recipient.workspace_id:
            errors["workspace"] = "Notification workspace must match its recipient."
        if self.source_payment_id and self.workspace_id != self.source_payment.workspace_id:
            errors["workspace"] = "Notification workspace must match its payment."
        if errors:
            raise ValidationError(errors)

    def _validate_transition(self):
        previous = type(self)._base_manager.get(pk=self.pk)
        for field in ("public_id", "workspace_id", "recipient_id", "source_payment_id", "kind", "created_at"):
            if getattr(previous, field) != getattr(self, field):
                raise NotificationWriteBoundaryViolation(f"Notification {field} is immutable.")
        valid = {
            (self.State.UNREAD, self.State.READ),
            (self.State.READ, self.State.ARCHIVED),
        }
        if (previous.state, self.state) not in valid:
            raise NotificationWriteBoundaryViolation("Notification state transitions are one-way.")
        if previous.state == self.State.READ and previous.read_at != self.read_at:
            raise NotificationWriteBoundaryViolation("Notification read timestamp is immutable.")

    def save(self, *args, **kwargs):
        if not _writes_allowed():
            raise NotificationWriteBoundaryViolation("Notifications require the notification service boundary.")
        if not self._state.adding:
            self._validate_transition()
        self.full_clean()
        return super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise NotificationWriteBoundaryViolation("Notifications are retained until recipient deletion.")
