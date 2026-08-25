from uuid import UUID

from django.db import transaction
from django.utils import timezone

from workspaces.context import ActiveWorkspaceContext
from workspaces.models import Membership

from .models import InAppNotification, notification_write_boundary


class NotificationAccessDenied(PermissionError):
    pass


def _membership(context: ActiveWorkspaceContext, *, lock=False) -> Membership:
    try:
        queryset = Membership.objects.select_related("user")
        if lock:
            queryset = queryset.select_for_update()
        membership = queryset.get(pk=context.membership.pk, workspace=context.workspace)
    except (AttributeError, ValueError, Membership.DoesNotExist) as error:
        raise NotificationAccessDenied("Active workspace membership is required.") from error
    if not membership.user.is_active:
        raise NotificationAccessDenied("Active workspace membership is required.")
    return membership


def _public_id(value) -> UUID:
    try:
        return UUID(str(value))
    except (TypeError, ValueError, AttributeError) as error:
        raise NotificationAccessDenied("Notification is not available.") from error


def _notification(membership: Membership, public_id: UUID) -> InAppNotification:
    try:
        return InAppNotification.objects.select_for_update().get(
            public_id=public_id, workspace=membership.workspace, recipient=membership
        )
    except InAppNotification.DoesNotExist as error:
        raise NotificationAccessDenied("Notification is not available.") from error


def fan_out_payment_recorded_notifications(payment, *, actor_membership: Membership) -> None:
    recipients = Membership.objects.filter(
        workspace=payment.workspace, user__is_active=True
    ).exclude(pk=actor_membership.pk)
    notifications = [
        InAppNotification(
            workspace=payment.workspace, recipient=recipient, source_payment=payment
        )
        for recipient in recipients
    ]
    if notifications:
        with notification_write_boundary():
            InAppNotification.objects.bulk_create(notifications)


def list_notifications(context: ActiveWorkspaceContext, *, include_archived=False):
    membership = _membership(context)
    notifications = InAppNotification.objects.filter(
        workspace=membership.workspace, recipient=membership
    )
    if not include_archived:
        notifications = notifications.exclude(state=InAppNotification.State.ARCHIVED)
    return notifications.order_by("-created_at", "-pk")


def read_notification(context: ActiveWorkspaceContext, public_id) -> InAppNotification:
    with transaction.atomic():
        membership = _membership(context, lock=True)
        notification = _notification(membership, _public_id(public_id))
        if notification.state == InAppNotification.State.UNREAD:
            notification.state, notification.read_at = InAppNotification.State.READ, timezone.now()
            with notification_write_boundary():
                notification.save(update_fields=["state", "read_at"])
        return notification


def archive_notification(context: ActiveWorkspaceContext, public_id) -> InAppNotification:
    with transaction.atomic():
        membership = _membership(context, lock=True)
        notification = _notification(membership, _public_id(public_id))
        if notification.state == InAppNotification.State.UNREAD:
            notification.state, notification.read_at = InAppNotification.State.READ, timezone.now()
            with notification_write_boundary():
                notification.save(update_fields=["state", "read_at"])
        if notification.state == InAppNotification.State.READ:
            notification.state, notification.archived_at = InAppNotification.State.ARCHIVED, timezone.now()
            with notification_write_boundary():
                notification.save(update_fields=["state", "archived_at"])
        return notification
