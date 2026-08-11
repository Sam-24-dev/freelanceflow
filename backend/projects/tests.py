from datetime import date
from decimal import Decimal
from queue import Queue
from threading import Barrier, Thread
from traceback import format_exc
from unittest.mock import patch

from django.core.exceptions import ValidationError
from django.db import DatabaseError, IntegrityError, connection, transaction, close_old_connections
from django.db.models.deletion import ProtectedError
from django.test import TestCase, TransactionTestCase

from accounts.models import User
from clients.models import Client
from projects.models import Project
from projects.services import (
    ProjectAccessDenied,
    ProjectTransitionError,
    archive_project,
    convert_accepted_proposal,
    transition_project,
)
from proposals.models import Proposal
from proposals.services import add_line_item, create_proposal, send_proposal, transition_proposal
from workspaces.context import ActiveWorkspaceContext
from workspaces.models import Membership
from workspaces.services import create_workspace_with_owner


class ProjectDomainTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(email="owner@example.com", password="password")
        self.workspace = create_workspace_with_owner(owner=self.owner, name="One", slug="one")
        self.owner_context = ActiveWorkspaceContext(
            workspace=self.workspace,
            membership=Membership.objects.get(workspace=self.workspace, user=self.owner),
        )
        self.client = Client.objects.create(
            workspace=self.workspace, legal_name="Client One", client_type=Client.ClientType.COMPANY,
            tax_identifier="ONE-1", primary_contact_name="Contact", primary_contact_email="one@example.com",
        )
        self.other_owner = User.objects.create_user(email="other@example.com", password="password")
        self.other_workspace = create_workspace_with_owner(owner=self.other_owner, name="Two", slug="two")
        self.other_context = ActiveWorkspaceContext(
            workspace=self.other_workspace,
            membership=Membership.objects.get(workspace=self.other_workspace, user=self.other_owner),
        )
        self.other_client = Client.objects.create(
            workspace=self.other_workspace, legal_name="Client Two", client_type=Client.ClientType.COMPANY,
            tax_identifier="TWO-1", primary_contact_name="Contact", primary_contact_email="two@example.com",
        )

    def _accepted_proposal(self):
        proposal = create_proposal(self.owner_context, self.client, "Accepted work", date.today(), date.today())
        add_line_item(self.owner_context, proposal, position=1, service_name="Manual", unit_of_measure="HOUR", quantity=Decimal("2"), unit_rate=Decimal("10"))
        proposal = send_proposal(self.owner_context, proposal)
        return transition_proposal(self.owner_context, proposal, Proposal.Status.ACCEPTED)

    def test_convert_accepted_proposal_derives_single_project_and_is_idempotent(self):
        proposal = self._accepted_proposal()
        project = convert_accepted_proposal(self.owner_context, proposal)
        retry = convert_accepted_proposal(self.owner_context, proposal)
        self.assertEqual(project.pk, retry.pk)
        self.assertEqual(project.workspace_id, proposal.workspace_id)
        self.assertEqual(project.client_id, proposal.client_id)
        self.assertEqual(project.proposal_id, proposal.pk)
        self.assertEqual(project.status, Project.Status.ACTIVE)
        proposal.refresh_from_db()
        self.assertEqual(proposal.status, Proposal.Status.CONVERTED)
        self.assertEqual(Project.objects.count(), 1)

    def test_only_accepted_proposals_in_active_workspace_can_convert(self):
        draft = create_proposal(self.owner_context, self.client, "Draft", date.today(), date.today())
        with self.assertRaises(ProjectTransitionError):
            convert_accepted_proposal(self.owner_context, draft)
        accepted = self._accepted_proposal()
        with self.assertRaises(ProjectAccessDenied):
            convert_accepted_proposal(self.other_context, accepted)

    def test_administrative_membership_cannot_convert(self):
        admin = User.objects.create_user(email="admin@example.com", password="password")
        membership = Membership.objects.create(workspace=self.workspace, user=admin, role=Membership.Role.ADMINISTRATIVE)
        proposal = self._accepted_proposal()
        with self.assertRaises(ProjectAccessDenied):
            convert_accepted_proposal(ActiveWorkspaceContext(workspace=self.workspace, membership=membership), proposal)

    def test_manual_creation_and_deletion_are_rejected(self):
        proposal = self._accepted_proposal()
        with self.assertRaises(ValidationError):
            Project.objects.create(workspace=self.workspace, client=self.client, proposal=proposal)
        project = convert_accepted_proposal(self.owner_context, proposal)
        with self.assertRaises(ValidationError):
            project.delete()
        with self.assertRaises(ValidationError):
            Project.objects.filter(pk=project.pk).delete()

    def test_project_lifecycle_and_terminal_archive(self):
        project = convert_accepted_proposal(self.owner_context, self._accepted_proposal())
        with self.assertRaises(ProjectTransitionError):
            archive_project(self.owner_context, project)
        completed = transition_project(self.owner_context, project, Project.Status.COMPLETED)
        self.assertIsNotNone(completed.completed_at)
        archived = archive_project(self.owner_context, completed)
        self.assertIsNotNone(archived.archived_at)
        with self.assertRaises(ProjectTransitionError):
            transition_project(self.owner_context, archived, Project.Status.CANCELLED)

    def test_model_and_database_reject_invalid_lifecycle_rows(self):
        proposal = self._accepted_proposal()
        with self.assertRaises(ValidationError):
            Project(workspace=self.workspace, client=self.client, proposal=proposal, status=Project.Status.COMPLETED).full_clean()
        with connection.cursor() as cursor:
            with self.assertRaises(IntegrityError), transaction.atomic():
                cursor.execute(
                    "INSERT INTO projects_project (workspace_id, client_id, proposal_id, public_id, status, created_at, updated_at) VALUES (%s, %s, %s, REPLACE(UUID(), '-', ''), 'COMPLETED', NOW(), NOW())",
                    [self.workspace.pk, self.client.pk, proposal.pk],
                )

    def test_base_manager_and_bulk_cannot_bypass_project_write_boundary(self):
        project = convert_accepted_proposal(self.owner_context, self._accepted_proposal())
        with self.assertRaises(ValidationError):
            Project._base_manager.filter(pk=project.pk).update(status=Project.Status.COMPLETED)
        with self.assertRaises(ValidationError):
            Project._base_manager.bulk_update([project], ["status"])
        with self.assertRaises(ValidationError):
            Project._base_manager.bulk_create([Project(workspace=self.workspace, client=self.client, proposal=project.proposal)])
        with self.assertRaises(ValidationError):
            Project._base_manager.filter(pk=project.pk).delete()

    def test_mysql_triggers_reject_cross_workspace_client_and_immutable_source(self):
        proposal = self._accepted_proposal()
        project = convert_accepted_proposal(self.owner_context, proposal)
        alternate = self._accepted_proposal()
        with connection.cursor() as cursor:
            with self.assertRaises(DatabaseError), transaction.atomic():
                cursor.execute(
                    "INSERT INTO projects_project (workspace_id, client_id, proposal_id, public_id, status, created_at, updated_at) VALUES (%s, %s, %s, REPLACE(UUID(), '-', ''), 'ACTIVE', NOW(), NOW())",
                    [self.other_workspace.pk, self.other_client.pk, alternate.pk],
                )
            with self.assertRaises(DatabaseError), transaction.atomic():
                cursor.execute("UPDATE projects_project SET workspace_id = %s WHERE id = %s", [self.other_workspace.pk, project.pk])
            with self.assertRaises(DatabaseError), transaction.atomic():
                cursor.execute("UPDATE projects_project SET client_id = %s WHERE id = %s", [self.other_client.pk, project.pk])
            with self.assertRaises(DatabaseError), transaction.atomic():
                cursor.execute("UPDATE projects_project SET proposal_id = %s WHERE id = %s", [alternate.pk, project.pk])
            with self.assertRaises(DatabaseError), transaction.atomic():
                cursor.execute("DELETE FROM projects_project WHERE id = %s", [project.pk])

    def test_workspace_client_and_proposal_are_protected(self):
        project = convert_accepted_proposal(self.owner_context, self._accepted_proposal())
        with self.assertRaises(ProtectedError):
            self.workspace.delete()
        with self.assertRaises(ProtectedError):
            self.client.delete()
        with self.assertRaises(ValidationError):
            project.proposal.delete()

    def test_mysql_insert_trigger_requires_accepted_proposal(self):
        draft = create_proposal(self.owner_context, self.client, "Draft source", date.today(), date.today())
        sent = create_proposal(self.owner_context, self.client, "Sent source", date.today(), date.today())
        add_line_item(self.owner_context, sent, position=1, service_name="Manual", unit_of_measure="HOUR", quantity=Decimal("1"), unit_rate=Decimal("1"))
        sent = send_proposal(self.owner_context, sent)
        rejected = create_proposal(self.owner_context, self.client, "Rejected source", date.today(), date.today())
        add_line_item(self.owner_context, rejected, position=1, service_name="Manual", unit_of_measure="HOUR", quantity=Decimal("1"), unit_rate=Decimal("1"))
        rejected = transition_proposal(self.owner_context, send_proposal(self.owner_context, rejected), Proposal.Status.REJECTED)
        expired = create_proposal(self.owner_context, self.client, "Expired source", date.today(), date.today())
        add_line_item(self.owner_context, expired, position=1, service_name="Manual", unit_of_measure="HOUR", quantity=Decimal("1"), unit_rate=Decimal("1"))
        expired = transition_proposal(self.owner_context, send_proposal(self.owner_context, expired), Proposal.Status.EXPIRED)
        converted = self._accepted_proposal()
        convert_accepted_proposal(self.owner_context, converted)
        accepted = self._accepted_proposal()

        with connection.cursor() as cursor:
            for proposal in (draft, sent, rejected, expired, converted):
                with self.assertRaises(DatabaseError), transaction.atomic():
                    cursor.execute(
                        "INSERT INTO projects_project (workspace_id, client_id, proposal_id, public_id, status, created_at, updated_at) VALUES (%s, %s, %s, REPLACE(UUID(), '-', ''), 'ACTIVE', NOW(), NOW())",
                        [self.workspace.pk, self.client.pk, proposal.pk],
                    )
            with transaction.atomic():
                cursor.execute(
                    "INSERT INTO projects_project (workspace_id, client_id, proposal_id, public_id, status, created_at, updated_at) VALUES (%s, %s, %s, REPLACE(UUID(), '-', ''), 'ACTIVE', NOW(), NOW())",
                    [self.workspace.pk, self.client.pk, accepted.pk],
                )
                transaction.set_rollback(True)




class ProjectConversionTransactionTests(TransactionTestCase):
    reset_sequences = True
    _immutable_trigger_names = (
        "proposal_no_commercial_update_after_sent",
        "proposal_no_delete_after_sent",
        "proposal_line_no_insert_after_sent",
        "proposal_line_no_update_after_sent",
        "proposal_line_no_delete_after_sent",
        "project_source_matches_proposal_on_insert",
        "project_source_immutable_on_update",
        "project_no_delete",
    )
    _trigger_definitions = None

    def _fixture_teardown(self):
        # TransactionTestCase flushes between tests. The production immutability
        # triggers deliberately reject those deletes, so preserve and restore
        # their exact test-database definitions around Django's flush.
        if self.__class__._trigger_definitions is None:
            with connection.cursor() as cursor:
                definitions = []
                for trigger_name in self._immutable_trigger_names:
                    cursor.execute("SHOW CREATE TRIGGER `{}`".format(trigger_name))
                    definitions.append(cursor.fetchone()[2])
                self.__class__._trigger_definitions = definitions
        with connection.cursor() as cursor:
            for trigger_name in self._immutable_trigger_names:
                cursor.execute("DROP TRIGGER IF EXISTS `{}`".format(trigger_name))
        super()._fixture_teardown()
        with connection.cursor() as cursor:
            for definition in self.__class__._trigger_definitions:
                cursor.execute(definition)

    def setUp(self):
        self.owner = User.objects.create_user(email="concurrent-owner@example.com", password="password")
        self.workspace = create_workspace_with_owner(owner=self.owner, name="Concurrent", slug="concurrent")
        self.owner_context = ActiveWorkspaceContext(
            workspace=self.workspace,
            membership=Membership.objects.get(workspace=self.workspace, user=self.owner),
        )
        self.client = Client.objects.create(
            workspace=self.workspace, legal_name="Concurrent Client", client_type=Client.ClientType.COMPANY,
            tax_identifier="CONCURRENT-1", primary_contact_name="Contact",
            primary_contact_email="concurrent@example.com",
        )

    def _accepted_proposal(self):
        proposal = create_proposal(
            self.owner_context, self.client, "Concurrent work", date.today(), date.today(), notes="Preserve this data"
        )
        add_line_item(
            self.owner_context, proposal, position=1, service_name="Manual", unit_of_measure="HOUR",
            quantity=Decimal("2"), unit_rate=Decimal("10"),
        )
        proposal = send_proposal(self.owner_context, proposal)
        return transition_proposal(self.owner_context, proposal, Proposal.Status.ACCEPTED)

    def test_concurrent_conversion_returns_one_project_and_preserves_proposal(self):
        proposal = self._accepted_proposal()
        original = {
            "workspace_id": proposal.workspace_id,
            "client_id": proposal.client_id,
            "title": proposal.title,
            "notes": proposal.notes,
            "lines": list(
                proposal.line_items.order_by("position").values_list(
                    "position", "service_name", "unit_of_measure", "quantity", "unit_rate", "currency"
                )
            ),
        }
        start = Barrier(2, timeout=10)
        results = Queue()

        def convert_in_independent_connection():
            close_old_connections()
            try:
                with connection.cursor() as cursor:
                    cursor.execute("SELECT CONNECTION_ID()")
                    connection_id = cursor.fetchone()[0]
                start.wait()
                project = convert_accepted_proposal(self.owner_context, proposal)
                results.put(("ok", project.pk, connection_id))
            except BaseException as error:
                results.put(("error", type(error).__name__, str(error), format_exc()))
            finally:
                close_old_connections()

        workers = [Thread(target=convert_in_independent_connection) for _ in range(2)]
        for worker in workers:
            worker.start()
        for worker in workers:
            worker.join(timeout=20)
        self.assertFalse(any(worker.is_alive() for worker in workers), "Concurrent conversion worker timed out.")

        outcomes = [results.get(timeout=1) for _ in workers]
        errors = [outcome for outcome in outcomes if outcome[0] == "error"]
        self.assertEqual(errors, [], errors)
        project_ids = [outcome[1] for outcome in outcomes]
        connection_ids = [outcome[2] for outcome in outcomes]
        self.assertNotEqual(connection_ids[0], connection_ids[1], "Workers did not use independent database connections.")
        self.assertEqual(project_ids[0], project_ids[1])
        self.assertEqual(Project.objects.filter(proposal_id=proposal.pk).count(), 1)

        proposal.refresh_from_db()
        self.assertEqual(proposal.status, Proposal.Status.CONVERTED)
        self.assertEqual(proposal.workspace_id, original["workspace_id"])
        self.assertEqual(proposal.client_id, original["client_id"])
        self.assertEqual(proposal.title, original["title"])
        self.assertEqual(proposal.notes, original["notes"])
        self.assertEqual(
            list(
                proposal.line_items.order_by("position").values_list(
                    "position", "service_name", "unit_of_measure", "quantity", "unit_rate", "currency"
                )
            ),
            original["lines"],
        )

    def test_conversion_rolls_back_project_when_transition_fails(self):
        proposal = self._accepted_proposal()

        with patch("projects.services.transition_proposal", side_effect=RuntimeError("forced transition failure")):
            with self.assertRaisesRegex(RuntimeError, "forced transition failure"):
                convert_accepted_proposal(self.owner_context, proposal)

        self.assertFalse(Project.objects.filter(proposal_id=proposal.pk).exists())
        proposal.refresh_from_db()
        self.assertEqual(proposal.status, Proposal.Status.ACCEPTED)
        self.assertFalse(Project.objects.filter(proposal=proposal).exists())
