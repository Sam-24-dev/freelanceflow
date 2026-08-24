from django.db import DatabaseError, connection, transaction
from django.db.models.deletion import ProtectedError
from django.test import TestCase, TransactionTestCase
from django.utils import timezone
from accounts.models import User
from audit.models import AuditEvent, AuditEventWorkspaceRequired, AuditEventWriteBoundaryViolation, audit_event_write_boundary
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

    def test_public_reads_require_an_explicit_workspace(self):
        event = self.append()
        with self.assertRaises(AuditEventWorkspaceRequired): AuditEvent.objects.all()
        with self.assertRaises(AuditEventWorkspaceRequired): AuditEvent.objects.filter(workspace=self.workspace).count()
        self.assertEqual(list(AuditEvent.objects.for_workspace(self.workspace)), [event])
        self.assertEqual(list(AuditEvent.objects.for_workspace(self.workspace).filter(pk=event.pk)), [event])

    def test_scoped_reads_reject_unscoped_or_cross_workspace_combinations(self):
        other_workspace = Workspace.objects.create(name="Other", slug="other")
        scoped = AuditEvent.objects.for_workspace(self.workspace)
        unscoped = AuditEvent._base_manager.all()
        other_scoped = AuditEvent.objects.for_workspace(other_workspace)
        for combine in (lambda: scoped | unscoped, lambda: scoped & unscoped, lambda: scoped.union(unscoped), lambda: scoped.intersection(unscoped), lambda: scoped.difference(unscoped), lambda: scoped | other_scoped, lambda: scoped.union(other_scoped)):
            with self.assertRaises(AuditEventWorkspaceRequired): combine()

    def test_base_manager_remains_available_for_django_relation_collection(self):
        self.append()
        self.assertIsNot(AuditEvent.objects, AuditEvent._base_manager)
        self.assertEqual(AuditEvent._base_manager.count(), 1)
        with self.assertRaises(ProtectedError): self.workspace.delete()

class AuditEventTriggerTests(TransactionTestCase):
    reset_sequences = True
    def setUp(self):
        self.user = User.objects.create_user("trigger@example.com", "password")
        self.workspace = Workspace.objects.create(name="Trigger", slug="trigger")
        self.member = Membership.objects.create(workspace=self.workspace, user=self.user, role=Membership.Role.OWNER)
    def insert(self, workspace_id, actor_id, target_id, *, role_after=Membership.Role.OWNER):
        with connection.cursor() as cursor:
            cursor.execute("INSERT INTO audit_auditevent (workspace_id, actor_id, event_type, target_membership_id, role_before, role_after, created_at) VALUES (%s,%s,%s,%s,%s,%s,%s)", [workspace_id, actor_id, "workspace.created", target_id, None, role_after, timezone.now()])
    def append(self):
        with audit_event_write_boundary():
            return AuditEvent.objects.create(workspace=self.workspace, actor=self.user, event_type=AuditEvent.EventType.WORKSPACE_CREATED, target_membership_id=self.member.pk, role_after=Membership.Role.OWNER)
    def assert_trigger_rejects(self, statement, params):
        with transaction.atomic(), self.assertRaises(DatabaseError):
            with connection.cursor() as cursor: cursor.execute(statement, params)
    def test_mysql_triggers_exist_and_reject_cross_tenant_target(self):
        foreign_user = User.objects.create_user("foreign@example.com", "password")
        foreign = Workspace.objects.create(name="Foreign", slug="foreign")
        foreign_member = Membership.objects.create(workspace=foreign, user=foreign_user, role=Membership.Role.OWNER)
        with connection.cursor() as cursor:
            cursor.execute("SELECT TRIGGER_NAME FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = DATABASE() AND EVENT_OBJECT_TABLE = 'audit_auditevent'")
            self.assertEqual({row[0] for row in cursor.fetchall()}, {"audit_event_validate_insert", "audit_event_immutable_update", "audit_event_immutable_delete"})
        with transaction.atomic(), self.assertRaises(DatabaseError): self.insert(self.workspace.pk, self.user.pk, foreign_member.pk)
    def test_mysql_trigger_rejects_update(self):
        event = self.append()
        self.assert_trigger_rejects("UPDATE audit_auditevent SET role_after = %s WHERE id = %s", [Membership.Role.ADMINISTRATIVE, event.pk])
    def test_mysql_trigger_rejects_delete(self):
        event = self.append()
        self.assert_trigger_rejects("DELETE FROM audit_auditevent WHERE id = %s", [event.pk])
    def test_mysql_trigger_rejects_invalid_target_membership(self): self.assert_trigger_rejects_insert(target_id=0)
    def test_mysql_trigger_rejects_missing_target_membership(self): self.assert_trigger_rejects_insert(target_id=self.member.pk + 1000)
    def test_mysql_trigger_rejects_invalid_actor(self): self.assert_trigger_rejects_insert(actor_id=self.user.pk + 1000)
    def test_mysql_trigger_rejects_cross_tenant_actor(self):
        foreign_user = User.objects.create_user("foreign-actor@example.com", "password")
        foreign = Workspace.objects.create(name="Foreign actor", slug="foreign-actor")
        Membership.objects.create(workspace=foreign, user=foreign_user, role=Membership.Role.OWNER)
        self.assert_trigger_rejects_insert(actor_id=foreign_user.pk)
    def test_mysql_trigger_rejects_workspace_created_without_role_after(self): self.assert_trigger_rejects_insert(role_after=None)
    def assert_trigger_rejects_insert(self, *, workspace_id=None, actor_id=None, target_id=None, role_after=Membership.Role.OWNER):
        with transaction.atomic(), self.assertRaises(DatabaseError):
            self.insert(workspace_id=self.workspace.pk if workspace_id is None else workspace_id, actor_id=self.user.pk if actor_id is None else actor_id, target_id=self.member.pk if target_id is None else target_id, role_after=role_after)
