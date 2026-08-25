import os
from importlib import import_module
from threading import Barrier, BrokenBarrierError, Thread
from unittest import TestCase, skipUnless
from uuid import uuid4

from django.conf import settings

if not settings.configured:
    os.environ.update({
        "DJANGO_SECRET_KEY": "static-only", "DJANGO_DB_NAME": "static",
        "DJANGO_DB_USER": "static", "DJANGO_DB_PASSWORD": "static",
        "DJANGO_DB_HOST": "127.0.0.1", "DJANGO_DB_PORT": "3306",
        "DJANGO_SETTINGS_MODULE": "config.settings",
    })
    import config.settings as project_settings
    project_settings.DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": ":memory:"}}
    import django
    django.setup()

from django.db import DatabaseError, IntegrityError, connection, connections, models
from django.test import TransactionTestCase
from django.utils import timezone

from accounts.models import User
from notifications.models import InAppNotification, NotificationWriteBoundaryViolation, notification_write_boundary
from notifications.services import (
    NotificationAccessDenied,
    archive_notification,
    list_notifications,
    read_notification,
)
from payments.models import Payment
from payments.tests import PaymentLedgerServiceTests
from preferences.models import MembershipInterfacePreference
from workspaces.context import ActiveWorkspaceContext
from workspaces.models import Membership, Workspace, allow_membership_writes


def _is_mysql_duplicate_key(error: IntegrityError) -> bool:
    seen, current = set(), error
    while current is not None and id(current) not in seen:
        seen.add(id(current))
        if getattr(current, "args", ()) and current.args[0] == 1062:
            return True
        current = current.__cause__ or current.__context__
    return False


@skipUnless(connection.vendor == "sqlite", "uses the noncredentialed SQLite model harness")
class NotificationSchemaTests(TestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        with connection.schema_editor() as editor:
            for model in (User, Workspace, Membership, MembershipInterfacePreference):
                editor.create_model(model)
            editor.execute("CREATE TABLE invoices_invoice (id integer PRIMARY KEY)")
            editor.create_model(Payment)
            editor.create_model(InAppNotification)

    def setUp(self):
        with connection.cursor() as cursor:
            for table in ("notifications_inappnotification", "payments_payment", "preferences_membershipinterfacepreference", "workspaces_membership", "workspaces_workspace", "accounts_user", "invoices_invoice"):
                cursor.execute(f"DELETE FROM {table}")
        self.user = User.objects.create_user("notification@example.com", "password")
        self.workspace = Workspace.objects.create(name="Notifications", slug="notifications")
        self.recipient = Membership.objects.create(workspace=self.workspace, user=self.user, role="OWNER")
        with connection.cursor() as cursor:
            cursor.execute("INSERT INTO invoices_invoice (id) VALUES (1)")
            cursor.execute("""INSERT INTO payments_payment (public_id, idempotency_key, fingerprint, amount, currency, source_type, source_reference, received_at, invoice_number_snapshot, invoice_total_snapshot, invoice_currency_snapshot, created_at, created_by_id, invoice_id, workspace_id) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""", [str(uuid4()), str(uuid4()), "x" * 64, 1, "USD", "CASH", "receipt", timezone.now(), "INV-1", 1, "USD", timezone.now(), self.user.pk, 1, self.workspace.pk])
        self.payment = Payment._base_manager.get()

    def notification(self):
        with notification_write_boundary():
            return InAppNotification.objects.create(workspace=self.workspace, recipient=self.recipient, source_payment=self.payment)

    def test_write_paths_and_lifecycle_are_guarded(self):
        candidate = InAppNotification(workspace=self.workspace, recipient=self.recipient, source_payment=self.payment)
        with self.assertRaises(NotificationWriteBoundaryViolation):
            InAppNotification._base_manager.create(workspace=self.workspace, recipient=self.recipient, source_payment=self.payment)
        with self.assertRaises(NotificationWriteBoundaryViolation):
            InAppNotification.objects.bulk_create([candidate])
        notification = self.notification()
        with self.assertRaises(NotificationWriteBoundaryViolation):
            InAppNotification.objects.filter(pk=notification.pk).update(state=InAppNotification.State.READ)
        with notification_write_boundary():
            notification.state, notification.read_at = InAppNotification.State.READ, timezone.now()
            notification.save()
            notification.state, notification.archived_at = InAppNotification.State.ARCHIVED, timezone.now()
            notification.save()
        with self.assertRaises(NotificationWriteBoundaryViolation):
            notification.delete()

    def test_public_id_is_immutable_during_a_valid_transition(self):
        notification = self.notification()
        notification.public_id, notification.state, notification.read_at = uuid4(), InAppNotification.State.READ, timezone.now()
        with notification_write_boundary(), self.assertRaises(NotificationWriteBoundaryViolation):
            notification.save()

    def test_recipient_defers_deletion_to_the_database_cascade(self):
        recipient = InAppNotification._meta.get_field("recipient")
        self.assertIs(recipient.remote_field.on_delete, models.DO_NOTHING)
        self.assertFalse(recipient.db_constraint)

    def test_mysql_duplicate_classifier_accepts_only_wrapped_errno_1062(self):
        wrapped = IntegrityError("Django wrapper")
        wrapped.__cause__ = Exception(1062, "Duplicate entry")

        self.assertTrue(_is_mysql_duplicate_key(wrapped))
        self.assertFalse(_is_mysql_duplicate_key(IntegrityError(1452, "Foreign key fails")))

    def test_declared_schema_has_current_dependencies_and_constraints(self):
        migration = import_module("notifications.migrations.0001_initial").Migration
        self.assertIn(("workspaces", "0002_alter_membership_user"), migration.dependencies)
        names = {constraint.name for constraint in InAppNotification._meta.constraints}
        self.assertTrue({"notification_source_payment_recipient_unique", "notification_supported_state", "notification_timestamp_shape", "notification_kind_fixed"} <= names)
        index = InAppNotification._meta.indexes[0]
        self.assertEqual(index.name, "notif_recipient_state_created")
        self.assertLessEqual(len(index.name), 30)
        fk = next(operation for operation in migration.operations if getattr(operation, "sql", "").startswith("ALTER TABLE notifications_inappnotification ADD CONSTRAINT notification_recipient_membership_fk"))
        self.assertEqual(fk.reverse_sql, "ALTER TABLE notifications_inappnotification DROP FOREIGN KEY notification_recipient_membership_fk")


@skipUnless(connection.vendor == "mysql" and os.getenv("FREELANCEFLOW_RUN_MYSQL_NOTIFICATION_TRIGGER_TESTS") == "1", "requires disposable MySQL trigger executor")
class NotificationMySqlTriggerTests(PaymentLedgerServiceTests):
    def test_raw_sql_rejects_public_id_mutation_and_direct_delete(self):
        payment = self._payment(self._issued_invoice())
        recipient = self.context.membership
        with notification_write_boundary():
            notification = InAppNotification.objects.create(workspace=self.workspace, recipient=recipient, source_payment=payment)
        with connection.cursor() as cursor, self.assertRaises(DatabaseError):
            cursor.execute("UPDATE notifications_inappnotification SET public_id = %s WHERE id = %s", [str(uuid4()), notification.pk])
        with connection.cursor() as cursor, self.assertRaises(DatabaseError):
            cursor.execute("DELETE FROM notifications_inappnotification WHERE id = %s", [notification.pk])

    def test_membership_delete_cascades_without_a_session_marker(self):
        payment = self._payment(self._issued_invoice())
        with notification_write_boundary():
            notification = InAppNotification.objects.create(workspace=self.workspace, recipient=self.context.membership, source_payment=payment)
        with allow_membership_writes():
            self.context.membership.delete()
        self.assertFalse(InAppNotification._base_manager.filter(pk=notification.pk).exists())

    def test_cross_workspace_insert_and_variable_spoof_are_rejected(self):
        payment = self._payment(self._issued_invoice())
        other = Workspace.objects.create(name="Other", slug=f"other-{uuid4().hex[:8]}")
        recipient = Membership.objects.create(workspace=other, user=self.owner, role="OWNER")
        with connection.cursor() as cursor, self.assertRaises(DatabaseError):
            cursor.execute("""INSERT INTO notifications_inappnotification (public_id, kind, state, created_at, recipient_id, source_payment_id, workspace_id) VALUES (%s, 'payment.recorded', 'UNREAD', %s, %s, %s, %s)""", [str(uuid4()), timezone.now(), recipient.pk, payment.pk, self.workspace.pk])
        with notification_write_boundary():
            notification = InAppNotification.objects.create(workspace=self.workspace, recipient=self.context.membership, source_payment=payment)
        with connection.cursor() as cursor:
            cursor.execute("SET @freelanceflow_notification_cleanup_memberships = %s", [str(self.context.membership.pk)])
            with self.assertRaises(DatabaseError):
                cursor.execute("DELETE FROM notifications_inappnotification WHERE id = %s", [notification.pk])


class NotificationServiceTests(PaymentLedgerServiceTests):
    def _recipient_context(self, email="recipient@example.com"):
        user = User.objects.create_user(email=email, password="password")
        membership = Membership.objects.create(workspace=self.workspace, user=user, role="OPERATIONAL")
        return ActiveWorkspaceContext(self.workspace, membership)

    def test_recipient_isolation_and_archived_notifications_are_hidden_by_default(self):
        first, second = self._recipient_context("first@example.com"), self._recipient_context("second@example.com")
        self._payment(self._issued_invoice())
        first_notification = list_notifications(first).get()

        self.assertEqual(list_notifications(second).count(), 1)
        archive_notification(first, first_notification.public_id)

        self.assertFalse(list_notifications(first).exists())
        self.assertEqual(list_notifications(first, include_archived=True).get().state, InAppNotification.State.ARCHIVED)

    def test_invalid_or_inactive_context_is_denied_without_notification_lookup(self):
        context = self._recipient_context()
        other = Workspace.objects.create(name="Other", slug="other-notifications")
        foreign = Membership.objects.create(workspace=other, user=User.objects.create_user(email="foreign@example.com", password="password"), role="OWNER")
        context.membership.user.is_active = False
        context.membership.user.save(update_fields=["is_active"])

        with self.assertRaises(NotificationAccessDenied):
            list_notifications(context)
        with self.assertRaises(NotificationAccessDenied):
            read_notification(context, uuid4())
        with self.assertRaises(NotificationAccessDenied):
            list_notifications(ActiveWorkspaceContext(self.workspace, foreign))

    def test_revoked_membership_context_is_denied_without_notification_writes(self):
        context = self._recipient_context("revoked@example.com")
        with allow_membership_writes():
            context.membership.delete()
        before = InAppNotification.objects.count()

        with self.assertRaises(NotificationAccessDenied) as denied:
            read_notification(context, uuid4())

        self.assertEqual(str(denied.exception), "Active workspace membership is required.")
        self.assertEqual(InAppNotification.objects.count(), before)

    def test_superuser_without_membership_is_denied_without_notification_writes(self):
        superuser = User.objects.create_superuser(email="superuser@example.com", password="password")
        context = ActiveWorkspaceContext(
            self.workspace,
            Membership(workspace=self.workspace, user=superuser, role="OWNER"),
        )
        before = InAppNotification.objects.count()

        with self.assertRaises(NotificationAccessDenied) as denied:
            archive_notification(context, uuid4())

        self.assertEqual(str(denied.exception), "Active workspace membership is required.")
        self.assertEqual(InAppNotification.objects.count(), before)

    def test_unknown_public_id_for_active_member_is_generic_and_does_not_write(self):
        context = self._recipient_context("unknown@example.com")
        before = InAppNotification.objects.count()

        with self.assertRaises(NotificationAccessDenied) as denied:
            archive_notification(context, uuid4())

        self.assertEqual(str(denied.exception), "Notification is not available.")
        self.assertEqual(InAppNotification.objects.count(), before)

    def test_read_and_archive_are_one_way_idempotent_transitions(self):
        context = self._recipient_context()
        self._payment(self._issued_invoice())
        notification = list_notifications(context).get()

        read = read_notification(context, notification.public_id)
        self.assertEqual(read.state, InAppNotification.State.READ)
        self.assertEqual(read_notification(context, notification.public_id).read_at, read.read_at)
        archived = archive_notification(context, notification.public_id)

        self.assertEqual(archived.state, InAppNotification.State.ARCHIVED)
        self.assertEqual(archive_notification(context, notification.public_id).archived_at, archived.archived_at)


if connection.vendor == "mysql":
    class NotificationMySqlConcurrencyTests(TransactionTestCase):
        setUp = PaymentLedgerServiceTests.setUp
        _issued_invoice = PaymentLedgerServiceTests._issued_invoice
        _payment = PaymentLedgerServiceTests._payment

        def test_concurrent_duplicate_recipient_insert_has_one_winner(self):
            payment = self._payment(self._issued_invoice())
            recipient = self.context.membership
            barrier, outcomes, failures, connection_ids = Barrier(2), {}, [], []

            def insert(label):
                db = connections["default"].copy(alias=f"notification-{label}-{uuid4().hex}")
                try:
                    db.ensure_connection()
                    db.set_autocommit(True)
                    self.assertTrue(db.get_autocommit())
                    with db.cursor() as cursor:
                        cursor.execute("SELECT CONNECTION_ID()")
                        connection_ids.append(cursor.fetchone()[0])
                    barrier.wait(timeout=10)
                    with db.cursor() as cursor:
                        cursor.execute("""INSERT INTO notifications_inappnotification (public_id, kind, state, created_at, recipient_id, source_payment_id, workspace_id) VALUES (%s, 'payment.recorded', 'UNREAD', %s, %s, %s, %s)""", [uuid4().hex, timezone.now(), recipient.pk, payment.pk, self.workspace.pk])
                    outcomes[label] = "inserted"
                except IntegrityError as error:
                    if _is_mysql_duplicate_key(error):
                        outcomes[label] = "duplicate"
                    else:
                        failures.append(error)
                except (AssertionError, BrokenBarrierError, DatabaseError) as error:
                    failures.append(error)
                finally:
                    barrier.abort()
                    try:
                        db.close()
                    except DatabaseError as error:
                        failures.append(error)

            threads = [
                Thread(target=insert, args=(label,)) for label in ("left", "right")
            ]
            try:
                [thread.start() for thread in threads]
                [thread.join(timeout=20) for thread in threads]
            finally:
                barrier.abort()
                [thread.join(timeout=5) for thread in threads]

            self.assertFalse(any(thread.is_alive() for thread in threads))
            self.assertFalse(failures, failures)
            self.assertEqual(len(set(connection_ids)), 2)
            self.assertEqual(sorted(outcomes.values()), ["duplicate", "inserted"])
            self.assertEqual(InAppNotification._base_manager.filter(source_payment=payment, recipient=recipient).count(), 1)

del PaymentLedgerServiceTests
