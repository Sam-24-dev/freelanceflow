from datetime import date, timedelta
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import DatabaseError, IntegrityError, connection, transaction
from django.db.models.deletion import ProtectedError
from django.test import TestCase
from django.utils import timezone

from accounts.models import User
from clients.models import Client
from proposals.models import Proposal, ProposalLineItem
from proposals.services import (
    ProposalAccessDenied,
    ProposalTransitionError,
    add_line_item,
    archive_proposal,
    create_proposal,
    get_proposals_for_workspace,
    send_proposal,
    transition_proposal,
    update_draft_proposal,
)
from services.models import Service
from workspaces.context import ActiveWorkspaceContext
from workspaces.models import Membership
from workspaces.services import create_workspace_with_owner


class ProposalDomainTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(email="owner@example.com", password="password")
        self.operational = User.objects.create_user(email="operator@example.com", password="password")
        self.administrative = User.objects.create_user(email="admin@example.com", password="password")
        self.other_owner = User.objects.create_user(email="other@example.com", password="password")
        self.workspace = create_workspace_with_owner(name="Primary", slug="primary", owner=self.owner)
        self.other_workspace = create_workspace_with_owner(name="Other", slug="other", owner=self.other_owner)
        Membership.objects.create(workspace=self.workspace, user=self.operational, role=Membership.Role.OPERATIONAL)
        Membership.objects.create(workspace=self.workspace, user=self.administrative, role=Membership.Role.ADMINISTRATIVE)
        Membership.objects.create(workspace=self.other_workspace, user=self.owner, role=Membership.Role.OPERATIONAL)
        self.owner_context = ActiveWorkspaceContext(workspace=self.workspace, membership=Membership.objects.get(workspace=self.workspace, user=self.owner))
        self.operational_context = ActiveWorkspaceContext(workspace=self.workspace, membership=Membership.objects.get(workspace=self.workspace, user=self.operational))
        self.administrative_context = ActiveWorkspaceContext(workspace=self.workspace, membership=Membership.objects.get(workspace=self.workspace, user=self.administrative))
        self.other_owner_context = ActiveWorkspaceContext(workspace=self.other_workspace, membership=Membership.objects.get(workspace=self.other_workspace, user=self.other_owner))
        self.client = self.make_client()
        self.other_client = self.make_client(workspace=self.other_workspace, suffix="other")
        self.service = Service.objects.create(workspace=self.workspace, name="Discovery", unit_of_measure="HOUR", rate=Decimal("100.00"))
        self.other_service = Service.objects.create(workspace=self.other_workspace, name="Other discovery", unit_of_measure="HOUR", rate=Decimal("50.00"))

    def make_client(self, workspace=None, suffix=""):
        return Client.objects.create(
            workspace=workspace or self.workspace, legal_name=f"Acme {suffix}", client_type="COMPANY",
            tax_identifier=f"tax-{suffix or 'primary'}", primary_contact_name="Ada",
            primary_contact_email=f"ada{suffix}@example.com",
        )

    def create_draft(self, **overrides):
        values = {"workspace": self.workspace, "client": self.client, "title": "Proposal", "issued_on": date.today(), "valid_until": date.today() + timedelta(days=7)}
        values.update(overrides)
        return Proposal.objects.create(**values)

    def test_proposal_is_tenant_scoped_uuid_and_protects_workspace_and_client(self):
        proposal = self.create_draft()
        self.assertIsNotNone(proposal.public_id)
        with self.assertRaises(ProtectedError): self.workspace.delete()
        with self.assertRaises(ProtectedError): self.client.delete()

    def test_line_allows_manual_snapshot_and_protects_linked_service(self):
        proposal = self.create_draft()
        manual = ProposalLineItem.objects.create(proposal=proposal, position=1, service_name="Manual", unit_of_measure="PROJECT", quantity=Decimal("1"), unit_rate=Decimal("0.00"))
        linked = ProposalLineItem.objects.create(proposal=proposal, position=2, source_service=self.service, service_name="Discovery", unit_of_measure="HOUR", quantity=Decimal("2"), unit_rate=Decimal("100.00"))
        self.assertIsNone(manual.source_service)
        self.assertEqual(linked.line_total, Decimal("200.00"))
        with self.assertRaises(ProtectedError): self.service.delete()

    def test_derived_totals_are_not_persisted(self):
        proposal = self.create_draft()
        ProposalLineItem.objects.create(proposal=proposal, position=1, service_name="A", unit_of_measure="HOUR", quantity=Decimal("1.50"), unit_rate=Decimal("10.00"))
        ProposalLineItem.objects.create(proposal=proposal, position=2, service_name="B", unit_of_measure="PROJECT", quantity=Decimal("1"), unit_rate=Decimal("2.00"))
        self.assertEqual(proposal.total, Decimal("17.00"))
        self.assertNotIn("total", [field.name for field in Proposal._meta.fields])
        self.assertNotIn("subtotal", [field.name for field in ProposalLineItem._meta.fields])

    def test_model_validation_rejects_invalid_line_and_date_values(self):
        proposal = Proposal(workspace=self.workspace, client=self.client, title="Bad date", issued_on=date.today(), valid_until=date.today() - timedelta(days=1))
        with self.assertRaises(ValidationError): proposal.full_clean()
        for overrides in ({"quantity": Decimal("0")}, {"unit_rate": Decimal("-0.01")}, {"currency": "EUR"}, {"unit_of_measure": "DAY"}):
            values = {"proposal": self.create_draft(), "position": 1, "service_name": "Bad", "unit_of_measure": "HOUR", "quantity": Decimal("1"), "unit_rate": Decimal("1")}
            values.update(overrides)
            line = ProposalLineItem(**values)
            with self.subTest(overrides=overrides):
                with self.assertRaises(ValidationError): line.full_clean()

    def test_database_constraints_reject_invalid_line_values_on_update_and_bulk_create(self):
        proposal = self.create_draft()
        line = ProposalLineItem.objects.create(proposal=proposal, position=1, service_name="A", unit_of_measure="HOUR", quantity=Decimal("1"), unit_rate=Decimal("1"))
        for field, value in (("quantity", Decimal("0")), ("unit_rate", Decimal("-1")), ("currency", "EUR"), ("unit_of_measure", "DAY")):
            with self.subTest(field=field):
                with self.assertRaises(IntegrityError), transaction.atomic(): ProposalLineItem.objects.filter(pk=line.pk).update(**{field: value})
        invalid = ProposalLineItem(proposal=proposal, position=2, service_name="B", unit_of_measure="HOUR", quantity=Decimal("1"), unit_rate=Decimal("1"), currency="EUR")
        with self.assertRaises(IntegrityError), transaction.atomic(): ProposalLineItem.objects.bulk_create([invalid])

    def test_database_constraints_reject_invalid_proposal_state_and_archive(self):
        proposal = self.create_draft()
        with self.assertRaises(IntegrityError), transaction.atomic(): Proposal.objects.filter(pk=proposal.pk).update(status=Proposal.Status.SENT)
        with self.assertRaises(IntegrityError), transaction.atomic(): Proposal.objects.filter(pk=proposal.pk).update(archived_at=timezone.now())

    def test_service_enforces_roles_workspace_and_snapshots(self):
        with self.assertRaises(ProposalAccessDenied): create_proposal(self.administrative_context, self.client, "No", date.today(), date.today())
        with self.assertRaises(ProposalAccessDenied): create_proposal(self.owner_context, self.other_client, "Cross", date.today(), date.today())
        proposal = create_proposal(self.operational_context, self.client, "Snapshot", date.today(), date.today())
        line = add_line_item(self.owner_context, proposal, position=1, source_service=self.service, quantity=Decimal("2"))
        self.assertEqual((line.service_name, line.unit_of_measure, line.unit_rate, line.currency), ("Discovery", "HOUR", Decimal("100.00"), "USD"))
        with self.assertRaises(ProposalAccessDenied): add_line_item(self.owner_context, proposal, position=2, source_service=self.other_service, quantity=Decimal("1"))

    def test_service_uses_active_workspace_context_not_caller_workspace(self):
        proposal = create_proposal(
            self.owner_context, self.client, "Context bound", date.today(), date.today()
        )
        self.assertEqual(proposal.workspace, self.owner_context.workspace)
        self.assertEqual(proposal.client, self.client)
        self.assertEqual(list(get_proposals_for_workspace(self.owner_context)), [proposal])
        with self.assertRaises(ProposalAccessDenied):
            create_proposal(
                self.owner_context, self.other_client, "Cross context", date.today(), date.today()
            )

    def test_for_workspace_and_service_transitions_enforce_boundary_and_immutability(self):
        proposal = create_proposal(self.owner_context, self.client, "Lifecycle", date.today(), date.today())
        self.assertEqual(list(get_proposals_for_workspace(self.owner_context)), [proposal])
        self.assertEqual(list(get_proposals_for_workspace(self.other_owner_context)), [])
        with self.assertRaises(ProposalTransitionError): send_proposal(self.owner_context, proposal)
        add_line_item(self.owner_context, proposal, position=1, service_name="Manual", unit_of_measure="PROJECT", quantity=Decimal("1"), unit_rate=Decimal("5"))
        sent = send_proposal(self.owner_context, proposal)
        self.assertEqual(sent.status, Proposal.Status.SENT)
        sent.title = "Changed"
        with self.assertRaises(ValidationError): sent.save()
        line = sent.line_items.get()
        line.unit_rate = Decimal("6")
        with self.assertRaises(ValidationError): line.save()
        with self.assertRaises(ProposalTransitionError): add_line_item(self.owner_context, proposal, position=2, service_name="Late", unit_of_measure="HOUR", quantity=Decimal("1"), unit_rate=Decimal("1"))
        accepted = transition_proposal(self.owner_context, proposal, Proposal.Status.ACCEPTED)
        converted = transition_proposal(self.owner_context, accepted, Proposal.Status.CONVERTED)
        archived = archive_proposal(self.owner_context, converted)
        self.assertIsNotNone(archived.archived_at)

    def _sent_proposal_with_line(self):
        proposal = create_proposal(self.owner_context, self.client, "Frozen", date.today(), date.today())
        line = add_line_item(
            self.owner_context, proposal, position=1, service_name="Manual",
            unit_of_measure="HOUR", quantity=Decimal("1"), unit_rate=Decimal("10"),
        )
        return send_proposal(self.owner_context, proposal), line

    def test_public_queryset_writes_cannot_bypass_sent_proposal_boundary(self):
        proposal, _ = self._sent_proposal_with_line()
        with self.assertRaises(ValidationError):
            Proposal.objects.filter(pk=proposal.pk).update(title="Bypass")
        proposal.title = "Bypass"
        with self.assertRaises(ValidationError):
            Proposal.objects.bulk_update([proposal], ["title"])
        with self.assertRaises(ValidationError):
            Proposal.objects.filter(pk=proposal.pk).delete()

    def test_public_line_queryset_writes_cannot_bypass_sent_proposal_boundary(self):
        proposal, line = self._sent_proposal_with_line()
        with self.assertRaises(ValidationError):
            ProposalLineItem.objects.filter(pk=line.pk).update(unit_rate=Decimal("11"))
        line.unit_rate = Decimal("11")
        with self.assertRaises(ValidationError):
            ProposalLineItem.objects.bulk_update([line], ["unit_rate"])
        late_line = ProposalLineItem(
            proposal=proposal, position=2, service_name="Late", unit_of_measure="HOUR",
            quantity=Decimal("1"), unit_rate=Decimal("1"),
        )
        with self.assertRaises(ValidationError):
            ProposalLineItem.objects.bulk_create([late_line])
        with self.assertRaises(ValidationError):
            ProposalLineItem.objects.filter(pk=line.pk).delete()
        line.description = "Public mutation"
        with self.assertRaises(ValidationError):
            line.save()
        with self.assertRaises(ValidationError):
            line.delete()

    def test_persisted_instances_require_controlled_boundary_and_services_edit_drafts(self):
        proposal = create_proposal(self.owner_context, self.client, "Draft", date.today(), date.today())
        proposal.title = "Public mutation"
        with self.assertRaises(ValidationError):
            proposal.save()
        updated = update_draft_proposal(self.owner_context, proposal, title="Authorized edit")
        self.assertEqual(updated.title, "Authorized edit")
        with self.assertRaises(ValidationError):
            updated.delete()
        add_line_item(self.owner_context, updated, position=1, service_name="Manual", unit_of_measure="HOUR", quantity=Decimal("1"), unit_rate=Decimal("1"))
        sent = send_proposal(self.owner_context, updated)
        with self.assertRaises(ProposalTransitionError):
            update_draft_proposal(self.owner_context, sent, title="Too late")

    def test_base_manager_cannot_bypass_sent_proposal_or_line_writes(self):
        proposal, line = self._sent_proposal_with_line()

        with self.assertRaises(ValidationError):
            Proposal._base_manager.filter(pk=proposal.pk).update(title="Base manager bypass")
        proposal.title = "Base manager bypass"
        with self.assertRaises(ValidationError):
            Proposal._base_manager.bulk_update([proposal], ["title"])
        with self.assertRaises(ValidationError):
            Proposal._base_manager.filter(pk=proposal.pk).delete()

        with self.assertRaises(ValidationError):
            ProposalLineItem._base_manager.filter(pk=line.pk).update(unit_rate=Decimal("11"))
        line.unit_rate = Decimal("11")
        with self.assertRaises(ValidationError):
            ProposalLineItem._base_manager.bulk_update([line], ["unit_rate"])
        late_line = ProposalLineItem(
            proposal=proposal, position=2, service_name="Late", unit_of_measure="HOUR",
            quantity=Decimal("1"), unit_rate=Decimal("1"),
        )
        with self.assertRaises(ValidationError):
            ProposalLineItem._base_manager.bulk_create([late_line])
        with self.assertRaises(ValidationError):
            ProposalLineItem._base_manager.filter(pk=line.pk).delete()

    def test_mysql_triggers_reject_direct_sql_commercial_writes_after_sent(self):
        proposal, line = self._sent_proposal_with_line()

        with connection.cursor() as cursor:
            with self.assertRaises(DatabaseError), transaction.atomic():
                cursor.execute("UPDATE proposals_proposal SET title = %s WHERE id = %s", ["SQL bypass", proposal.pk])
            with self.assertRaises(DatabaseError), transaction.atomic():
                cursor.execute(
                    "INSERT INTO proposals_proposallineitem "
                    "(proposal_id, position, service_name, description, unit_of_measure, quantity, unit_rate, currency, created_at, updated_at) "
                    "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW())",
                    [proposal.pk, 2, "SQL line", "", "HOUR", "1.00", "1.00", "USD"],
                )
            with self.assertRaises(DatabaseError), transaction.atomic():
                cursor.execute("UPDATE proposals_proposallineitem SET unit_rate = %s WHERE id = %s", ["11.00", line.pk])
            with self.assertRaises(DatabaseError), transaction.atomic():
                cursor.execute("DELETE FROM proposals_proposallineitem WHERE id = %s", [line.pk])
            with self.assertRaises(DatabaseError), transaction.atomic():
                cursor.execute("DELETE FROM proposals_proposal WHERE id = %s", [proposal.pk])
