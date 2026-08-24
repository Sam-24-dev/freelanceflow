from unittest.mock import patch

from django.db import DatabaseError, IntegrityError, connection, transaction
from django.db.models.deletion import ProtectedError
from django.test import TestCase, TransactionTestCase
from django.utils import timezone
from accounts.models import User
from audit.models import AuditEvent, AuditEventWorkspaceRequired, AuditEventWriteBoundaryViolation, audit_event_write_boundary
from workspaces.models import Membership, Workspace, allow_membership_writes
from workspaces.permissions import WorkspacePermissionDenied
from workspaces.services import (
    LastOwnerViolation,
    change_membership_role,
    create_workspace_with_owner,
    remove_membership,
)

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


class AuditEventSourceEventTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user("audit-owner@example.com", "password")
        self.workspace = create_workspace_with_owner(
            name="Audit Studio", slug="audit-studio", owner=self.owner
        )
        self.owner_membership = Membership.objects.get(
            workspace=self.workspace, user=self.owner
        )

    def events(self):
        return AuditEvent.objects.for_workspace(self.workspace)

    def member(self, email="audit-member@example.com", role=Membership.Role.OPERATIONAL):
        user = User.objects.create_user(email, "password")
        return Membership.objects.create(workspace=self.workspace, user=user, role=role)

    def test_workspace_creation_appends_one_owner_snapshot(self):
        events = list(self.events())

        self.assertEqual(len(events), 1)
        event = events[0]
        self.assertEqual(
            (event.event_type, event.actor, event.target_membership_id, event.role_before, event.role_after),
            (AuditEvent.EventType.WORKSPACE_CREATED, self.owner, self.owner_membership.pk, None, Membership.Role.OWNER),
        )

    def test_role_change_and_removal_append_tenant_bound_snapshots(self):
        member = self.member()

        change_membership_role(
            workspace_id=self.workspace.pk,
            membership_id=member.pk,
            role=Membership.Role.ADMINISTRATIVE,
            actor=self.owner,
        )
        self.assertEqual(self.events().count(), 2)
        remove_membership(
            workspace_id=self.workspace.pk,
            membership_id=member.pk,
            actor=self.owner,
        )

        changed, removed = list(self.events().order_by("pk"))[-2:]
        self.assertEqual(
            (changed.event_type, changed.target_membership_id, changed.role_before, changed.role_after),
            (AuditEvent.EventType.MEMBERSHIP_ROLE_CHANGED, member.pk, Membership.Role.OPERATIONAL, Membership.Role.ADMINISTRATIVE),
        )
        self.assertEqual(
            (removed.event_type, removed.target_membership_id, removed.role_before, removed.role_after),
            (AuditEvent.EventType.MEMBERSHIP_REMOVED, member.pk, Membership.Role.ADMINISTRATIVE, None),
        )
        self.assertEqual(self.events().count(), 3)
        self.assertFalse(Membership.objects.filter(pk=member.pk).exists())

    def test_audit_and_source_mutations_rollback_together(self):
        member = self.member()
        baseline = self.events().count()

        with patch("workspaces.services.record_audit_event", side_effect=IntegrityError):
            with self.assertRaises(IntegrityError):
                change_membership_role(
                    workspace_id=self.workspace.pk,
                    membership_id=member.pk,
                    role=Membership.Role.ADMINISTRATIVE,
                    actor=self.owner,
                )
        member.refresh_from_db()
        self.assertEqual(member.role, Membership.Role.OPERATIONAL)
        self.assertEqual(self.events().count(), baseline)

        with patch.object(Membership, "delete", side_effect=IntegrityError):
            with self.assertRaises(IntegrityError):
                remove_membership(
                    workspace_id=self.workspace.pk,
                    membership_id=member.pk,
                    actor=self.owner,
                )
        self.assertTrue(Membership.objects.filter(pk=member.pk).exists())
        self.assertEqual(self.events().count(), baseline)

    def test_non_last_owner_can_remove_themself_and_records_once_before_deletion(self):
        self.member("second-audit-owner@example.com", Membership.Role.OWNER)

        remove_membership(
            workspace_id=self.workspace.pk,
            membership_id=self.owner_membership.pk,
            actor=self.owner,
        )

        event = self.events().order_by("pk").last()
        self.assertEqual(
            (event.event_type, event.actor, event.target_membership_id, event.role_before, event.role_after),
            (AuditEvent.EventType.MEMBERSHIP_REMOVED, self.owner, self.owner_membership.pk, Membership.Role.OWNER, None),
        )
        self.assertFalse(Membership.objects.filter(pk=self.owner_membership.pk).exists())

    def test_last_owner_and_unauthorized_actors_cannot_mutate_or_append(self):
        member = self.member()
        baseline = self.events().count()

        with self.assertRaises(LastOwnerViolation):
            remove_membership(
                workspace_id=self.workspace.pk,
                membership_id=self.owner_membership.pk,
                actor=self.owner,
            )
        stale_owner = self.member("stale-owner@example.com", Membership.Role.OWNER)
        with allow_membership_writes():
            stale_owner.role = Membership.Role.ADMINISTRATIVE
            stale_owner.save(update_fields=["role"])
        inactive_owner = self.member("inactive-owner@example.com", Membership.Role.OWNER)
        inactive_owner.user.is_active = False
        inactive_owner.user.save(update_fields=["is_active"])
        superuser = User.objects.create_superuser("audit-super@example.com", "password")
        for actor in (member.user, stale_owner.user, inactive_owner.user, superuser):
            with self.subTest(actor=actor.pk), self.assertRaises(WorkspacePermissionDenied):
                change_membership_role(
                    workspace_id=self.workspace.pk,
                    membership_id=member.pk,
                    role=Membership.Role.ADMINISTRATIVE,
                    actor=actor,
                )
        self.assertEqual(self.events().count(), baseline)

    def test_same_role_change_is_a_noop_without_audit_recursion(self):
        member = self.member("same-role@example.com")
        baseline = self.events().count()

        result = change_membership_role(
            workspace_id=self.workspace.pk,
            membership_id=member.pk,
            role=Membership.Role.OPERATIONAL,
            actor=self.owner,
        )

        self.assertEqual(result.pk, member.pk)
        self.assertEqual(self.events().count(), baseline)
