from django.db import DatabaseError, connection, transaction
from django.test import TestCase, TransactionTestCase
from django.utils import timezone
from accounts.models import User
from audit.models import AuditEvent, AuditEventWriteBoundaryViolation, audit_event_write_boundary
from workspaces.models import Membership, Workspace

class AuditEventSchemaTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user("schema@example.com", "password")
        self.workspace = Workspace.objects.create(name="Schema", slug="schema")
        self.membership = Membership.objects.create(workspace=self.workspace, user=self.user, role=Membership.Role.OWNER)
    def append(self):
        with audit_event_write_boundary():
            return AuditEvent.objects.create(workspace=self.workspace, actor=self.user, event_type=AuditEvent.EventType.WORKSPACE_CREATED, target_membership_id=self.membership.pk, role_before=None, role_after=Membership.Role.OWNER)
    def test_orm_writes_are_append_only(self):
        event = self.append()
        with self.assertRaises(AuditEventWriteBoundaryViolation): event.delete()
        with self.assertRaises(AuditEventWriteBoundaryViolation): AuditEvent.objects.filter(pk=event.pk).update(role_after=Membership.Role.OPERATIONAL)
        with self.assertRaises(AuditEventWriteBoundaryViolation): AuditEvent.objects.create(workspace=self.workspace, actor=self.user, event_type=AuditEvent.EventType.WORKSPACE_CREATED, target_membership_id=self.membership.pk, role_after=Membership.Role.OWNER)

class AuditEventTriggerTests(TransactionTestCase):
    reset_sequences = True
    def setUp(self):
        self.user = User.objects.create_user("trigger@example.com", "password")
        self.workspace = Workspace.objects.create(name="Trigger", slug="trigger")
        self.member = Membership.objects.create(workspace=self.workspace, user=self.user, role=Membership.Role.OWNER)
    def insert(self, workspace_id, actor_id, target_id):
        with connection.cursor() as cursor:
            cursor.execute("INSERT INTO audit_auditevent (workspace_id, actor_id, event_type, target_membership_id, role_before, role_after, created_at) VALUES (%s,%s,%s,%s,%s,%s,%s)", [workspace_id, actor_id, "workspace.created", target_id, None, Membership.Role.OWNER, timezone.now()])
    def test_mysql_triggers_exist_and_reject_cross_tenant_target(self):
        foreign_user = User.objects.create_user("foreign@example.com", "password")
        foreign = Workspace.objects.create(name="Foreign", slug="foreign")
        foreign_member = Membership.objects.create(workspace=foreign, user=foreign_user, role=Membership.Role.OWNER)
        with connection.cursor() as cursor:
            cursor.execute("SELECT TRIGGER_NAME FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = DATABASE() AND EVENT_OBJECT_TABLE = 'audit_auditevent'")
            self.assertEqual({row[0] for row in cursor.fetchall()}, {"audit_event_validate_insert", "audit_event_immutable_update", "audit_event_immutable_delete"})
        with transaction.atomic(), self.assertRaises(DatabaseError):
            self.insert(self.workspace.pk, self.user.pk, foreign_member.pk)