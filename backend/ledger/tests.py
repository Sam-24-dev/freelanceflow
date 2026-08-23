import importlib
from datetime import date
from inspect import signature
from decimal import Decimal
from unittest.mock import Mock, call, patch
from uuid import uuid4

from django.core.exceptions import ValidationError
from django.db import DatabaseError, IntegrityError, connection, transaction
from django.test import SimpleTestCase, TestCase, TransactionTestCase

from accounts.models import User
from categories.models import Category
from clients.models import Client
from ledger import services as ledger_services
from ledger.models import LedgerEntry, _ledger_service_write_boundary, calculate_request_fingerprint
from ledger.services import (
    LedgerAccessDenied,
    LedgerIdempotencyConflict,
    get_ledger_entries,
    record_manual_entry,
)
from projects.services import convert_accepted_proposal
from proposals.models import Proposal
from proposals.services import add_line_item, create_proposal, send_proposal, transition_proposal
from workspaces.context import ActiveWorkspaceContext
from workspaces.models import Membership, allow_membership_writes
from workspaces.services import create_workspace_with_owner


class LedgerModelTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="ledger@example.com", password="password")
        self.workspace = create_workspace_with_owner(owner=self.user, name="Ledger", slug="ledger")
        self.category = Category.objects.create(workspace=self.workspace, name="Travel", default_deductible=True)

    def entry_values(self, **overrides):
        values = {"workspace": self.workspace, "idempotency_key": uuid4(), "direction": "EXPENSE", "amount": Decimal("1.00"), "occurred_on": date(2026, 8, 23), "description": "  Taxi  ", "category": self.category, "category_name_snapshot": "Travel", "category_deductible_snapshot": True, "created_by": self.user}
        values.update(overrides)
        return values

    def entry(self, **overrides):
        with _ledger_service_write_boundary():
            return LedgerEntry.objects.create(**self.entry_values(**overrides))

    def test_manual_expense_uses_active_category_facts_and_is_immutable(self):
        entry = self.entry()
        self.assertEqual(entry.description, "Taxi")
        with self.assertRaises(ValidationError):
            self.entry(category_name_snapshot="Forged")
        self.category.status = Category.Status.INACTIVE
        self.category.save()
        with self.assertRaises(ValidationError):
            self.entry()
        with self.assertRaises(ValidationError):
            entry.delete()
        with self.assertRaises(ValidationError):
            LedgerEntry.objects.filter(pk=entry.pk).update(description="x")

    def test_public_orm_create_requires_ledger_service_authorization(self):
        with self.assertRaisesRegex(ValidationError, "Ledger entries must use the ledger services"):
            LedgerEntry.objects.create(**self.entry_values())
        with self.assertRaisesRegex(ValidationError, "Ledger entries must use the ledger services"):
            LedgerEntry(**self.entry_values()).save()
        with self.assertRaisesRegex(ValidationError, "Ledger entries must use the ledger services"):
            LedgerEntry.objects.bulk_create([LedgerEntry(**self.entry_values())])

    def test_persisted_entry_cannot_mutate_or_delete_through_any_orm_route(self):
        entry = self.entry()
        entry.description = "Changed"

        with self.assertRaisesRegex(ValidationError, "immutable"):
            entry.save()
        with self.assertRaisesRegex(ValidationError, "cannot be deleted"):
            entry.delete()
        with self.assertRaisesRegex(ValidationError, "immutable"):
            LedgerEntry.objects.filter(pk=entry.pk).update(description="Changed")
        with self.assertRaisesRegex(ValidationError, "immutable"):
            LedgerEntry.objects.bulk_update([entry], ["description"])
        with self.assertRaisesRegex(ValidationError, "cannot be deleted"):
            LedgerEntry.objects.filter(pk=entry.pk).delete()

    def test_reversal_must_fully_mirror_a_manual_entry_except_direction(self):
        original = self.entry()
        reversal = self.entry(source="REVERSAL", reversal_of=original, direction="INCOME")
        self.assertEqual(reversal.reversal_of_id, original.pk)
        with self.assertRaises(ValidationError):
            self.entry(source="REVERSAL", reversal_of=original, direction="EXPENSE")


class LedgerRequestFingerprintTests(SimpleTestCase):
    def test_canonical_request_fingerprint_ignores_nonsemantic_values_and_changes_for_each_semantic_dimension(self):
        values = {
            "workspace_id": 1,
            "direction": "EXPENSE",
            "source": "MANUAL",
            "amount": Decimal("1.00"),
            "currency": "USD",
            "occurred_on": date(2026, 8, 23),
            "description": "  Taxi   ride  ",
            "category_id": 2,
            "client_id": 3,
            "project_id": 4,
            "reversal_of_id": None,
        }
        baseline = calculate_request_fingerprint(**values)
        self.assertEqual(baseline, calculate_request_fingerprint(**{**values, "description": "Taxi ride"}))
        for field, value in {
            "workspace_id": 10, "direction": "INCOME", "source": "REVERSAL", "amount": Decimal("2.00"),
            "currency": "EUR", "occurred_on": date(2026, 8, 24), "description": "Train ride",
            "category_id": 20, "client_id": 30, "project_id": 40, "reversal_of_id": 50,
        }.items():
            with self.subTest(field=field):
                self.assertNotEqual(baseline, calculate_request_fingerprint(**{**values, field: value}))


class LedgerRequestFingerprintMigrationTests(SimpleTestCase):
    def test_preflight_rejects_legacy_rows_before_non_null_request_fingerprint(self):
        migration = importlib.import_module("ledger.migrations.0002_add_request_fingerprint")
        model = Mock()
        model.objects.exists.return_value = True
        apps = Mock()
        apps.get_model.return_value = model

        with self.assertRaisesRegex(RuntimeError, "empty ledger table"):
            migration.ensure_ledger_table_is_empty(apps, None)

    def test_trigger_replacement_has_no_fake_noop_reverse(self):
        migration = importlib.import_module("ledger.migrations.0002_add_request_fingerprint")
        trigger_operations = [
            operation for operation in migration.Migration.operations
            if isinstance(operation, migration.migrations.RunSQL)
        ]

        self.assertEqual([operation.reverse_sql for operation in trigger_operations], [None, None])


class LedgerMySQLIntegrityTests(TransactionTestCase):
    reset_sequences = True

    def setUp(self):
        self.user = User.objects.create_user(email="ledger-sql@example.com", password="password")
        self.workspace = create_workspace_with_owner(owner=self.user, name="Ledger SQL", slug="ledger-sql")
        self.other_user = User.objects.create_user(email="ledger-other@example.com", password="password")
        self.other_workspace = create_workspace_with_owner(owner=self.other_user, name="Other ledger", slug="other-ledger")
        self.category = Category.objects.create(workspace=self.workspace, name="Travel", default_deductible=True)
        self.other_category = Category.objects.create(workspace=self.other_workspace, name="Other travel", default_deductible=False)
        self.client = self._client(self.workspace, "Ledger client", "ledger-client")
        self.second_client = self._client(self.workspace, "Second ledger client", "second-ledger-client")
        self.other_client = self._client(self.other_workspace, "Other client", "other-client")
        context = ActiveWorkspaceContext(self.workspace, Membership.objects.get(workspace=self.workspace, user=self.user))
        self.project = self._project(context, self.client, "Ledger project")
        other_context = ActiveWorkspaceContext(self.other_workspace, Membership.objects.get(workspace=self.other_workspace, user=self.other_user))
        self.other_project = self._project(other_context, self.other_client, "Other project")

    def _project(self, context, client, title):
        proposal = create_proposal(context, client, title, date.today(), date.today())
        add_line_item(context, proposal, position=1, service_name="Manual", unit_of_measure="HOUR", quantity=Decimal("1.00"), unit_rate=Decimal("1.00"))
        proposal = send_proposal(context, proposal)
        return convert_accepted_proposal(context, transition_proposal(context, proposal, Proposal.Status.ACCEPTED))

    def _client(self, workspace, legal_name, token):
        return Client.objects.create(workspace=workspace, legal_name=legal_name, client_type=Client.ClientType.COMPANY, tax_identifier=token, primary_contact_name="Contact", primary_contact_email=f"{token}@example.com")

    def _insert(self, **overrides):
        values = {"workspace_id": self.workspace.pk, "public_id": uuid4().hex, "idempotency_key": uuid4().hex, "direction": "EXPENSE", "source": "MANUAL", "amount": Decimal("1.00"), "currency": "USD", "occurred_on": date(2026, 8, 23), "description": "Taxi", "category_id": self.category.pk, "category_name_snapshot": "Travel", "category_deductible_snapshot": True, "client_id": self.client.pk, "project_id": None, "reversal_of_id": None, "created_by_id": self.user.pk}
        values.update(overrides)
        columns = ", ".join(values)
        placeholders = ", ".join(["%s"] * len(values))
        with connection.cursor() as cursor:
            cursor.execute(f"INSERT INTO ledger_ledgerentry ({columns}, created_at, fingerprint, request_fingerprint) VALUES ({placeholders}, NOW(), 'forged', 'forged-request')", list(values.values()))
            return cursor.lastrowid

    def test_direct_sql_overwrites_forged_request_fingerprint_with_semantic_value(self):
        first_id = self._insert(description="  Taxi   ride  ")
        second_id = self._insert(description="Taxi ride", created_by_id=self.other_user.pk)
        first = LedgerEntry.objects.get(pk=first_id)
        second = LedgerEntry.objects.get(pk=second_id)

        self.assertEqual(first.request_fingerprint, second.request_fingerprint)
        self.assertNotEqual(first.request_fingerprint, "forged-request")
        self.assertEqual(first.request_fingerprint, calculate_request_fingerprint(
            workspace_id=self.workspace.pk, direction="EXPENSE", source="MANUAL", amount=Decimal("1.00"),
            currency="USD", occurred_on=date(2026, 8, 23), description="Taxi ride", category_id=self.category.pk,
            client_id=self.client.pk, project_id=None, reversal_of_id=None,
        ))

    def test_direct_sql_rejects_forged_scalars_category_status_and_tenant_links(self):
        cases = (
            {"description": "   "}, {"currency": "EUR"},
            {"category_id": self.other_category.pk, "category_name_snapshot": "Other travel", "category_deductible_snapshot": False},
            {"client_id": self.other_client.pk}, {"project_id": self.project.pk, "client_id": None},
            {"project_id": self.other_project.pk},
            {"category_name_snapshot": "forged"},
        )
        for overrides in cases:
            with self.subTest(overrides=overrides):
                with self.assertRaises(DatabaseError), transaction.atomic():
                    self._insert(**overrides)
        with connection.cursor() as cursor:
            cursor.execute("UPDATE categories_category SET status = 'INACTIVE' WHERE id = %s", [self.category.pk])
        with self.assertRaises(DatabaseError), transaction.atomic():
            self._insert()

    def test_direct_sql_rejects_invalid_reversal_and_any_update_or_delete(self):
        original_id = self._insert()
        with self.assertRaises(DatabaseError), transaction.atomic():
            self._insert(source="REVERSAL", reversal_of_id=original_id, direction="EXPENSE")
        with connection.cursor() as cursor:
            cursor.execute("UPDATE categories_category SET status = 'ACTIVE' WHERE id = %s", [self.category.pk])
        reversal_id = self._insert(source="REVERSAL", reversal_of_id=original_id, direction="INCOME")
        self.assertRegex(LedgerEntry.objects.get(pk=reversal_id).fingerprint, r"^[0-9a-f]{64}$")
        for statement in ("UPDATE ledger_ledgerentry SET description = 'changed' WHERE id = %s", "DELETE FROM ledger_ledgerentry WHERE id = %s"):
            with self.subTest(statement=statement):
                with self.assertRaises(DatabaseError), transaction.atomic():
                    with connection.cursor() as cursor:
                        cursor.execute(statement, [reversal_id])


class LedgerManualEntryServiceTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(email="ledger-owner@example.com", password="password")
        self.workspace = create_workspace_with_owner(owner=self.owner, name="Ledger services", slug="ledger-services")
        self.context = ActiveWorkspaceContext(self.workspace, Membership.objects.get(workspace=self.workspace, user=self.owner))
        self.operational = User.objects.create_user(email="ledger-operator@example.com", password="password")
        self.operational_context = ActiveWorkspaceContext(self.workspace, Membership.objects.create(workspace=self.workspace, user=self.operational, role=Membership.Role.OPERATIONAL))
        self.administrative = User.objects.create_user(email="ledger-admin@example.com", password="password")
        self.administrative_context = ActiveWorkspaceContext(self.workspace, Membership.objects.create(workspace=self.workspace, user=self.administrative, role=Membership.Role.ADMINISTRATIVE))
        self.category = Category.objects.create(workspace=self.workspace, name="Travel", default_deductible=True)
        self.client = self._client(self.workspace, "Ledger client", "ledger-client")
        self.second_client = self._client(self.workspace, "Second ledger client", "second-ledger-client")
        self.other_owner = User.objects.create_user(email="ledger-other-owner@example.com", password="password")
        self.other_workspace = create_workspace_with_owner(owner=self.other_owner, name="Other ledger services", slug="other-ledger-services")
        self.other_context = ActiveWorkspaceContext(self.other_workspace, Membership.objects.get(workspace=self.other_workspace, user=self.other_owner))
        self.other_category = Category.objects.create(workspace=self.other_workspace, name="Other travel", default_deductible=False)
        self.other_client = self._client(self.other_workspace, "Other client", "other-client")
        self.project = self._project(self.context, self.client, "Ledger project")
        self.other_project = self._project(self.other_context, self.other_client, "Other ledger project")

    def _client(self, workspace, legal_name, token):
        return Client.objects.create(workspace=workspace, legal_name=legal_name, client_type=Client.ClientType.COMPANY, tax_identifier=token, primary_contact_name="Contact", primary_contact_email=f"{token}@example.com")

    def _project(self, context, client, title):
        proposal = create_proposal(context, client, title, date.today(), date.today())
        add_line_item(context, proposal, position=1, service_name="Manual", unit_of_measure="HOUR", quantity=Decimal("1.00"), unit_rate=Decimal("1.00"))
        return convert_accepted_proposal(context, transition_proposal(context, send_proposal(context, proposal), Proposal.Status.ACCEPTED))

    def record(self, context=None, **overrides):
        values = {"idempotency_key": uuid4(), "direction": LedgerEntry.Direction.EXPENSE, "amount": Decimal("12.00"), "occurred_on": date(2026, 8, 23), "description": "  Taxi   ride  ", "category": self.category, "client": self.client}
        values.update(overrides)
        return record_manual_entry(self.context if context is None else context, **values)

    def test_requires_current_owner_or_operational_active_membership(self):
        with self.assertRaises(LedgerAccessDenied):
            self.record(context=object())
        with self.assertRaises(LedgerAccessDenied):
            self.record(context=self.administrative_context)
        self.operational.is_active = False
        self.operational.save(update_fields=["is_active"])
        with self.assertRaises(LedgerAccessDenied):
            self.record(context=self.operational_context)
        superuser = User.objects.create_superuser(email="ledger-super@example.com", password="password")
        missing_membership = ActiveWorkspaceContext(self.workspace, Membership(workspace=self.workspace, user=superuser, role=Membership.Role.OWNER))
        with self.assertRaises(LedgerAccessDenied):
            self.record(context=missing_membership)
        revoked = User.objects.create_user(email="ledger-revoked@example.com", password="password")
        revoked_membership = Membership.objects.create(workspace=self.workspace, user=revoked, role=Membership.Role.OPERATIONAL)
        revoked_context = ActiveWorkspaceContext(self.workspace, revoked_membership)
        with allow_membership_writes():
            revoked_membership.delete()
        with self.assertRaises(LedgerAccessDenied):
            self.record(context=revoked_context)

    def test_derives_provenance_and_rejects_cross_workspace_relations(self):
        entry = self.record()
        self.assertEqual(entry.workspace_id, self.workspace.pk)
        self.assertEqual(entry.created_by_id, self.owner.pk)
        for field, value in (("category", self.other_category), ("client", self.other_client), ("project", self.other_project)):
            with self.subTest(field=field):
                with self.assertRaises(LedgerAccessDenied):
                    self.record(**{field: value})
        with self.assertRaises(LedgerAccessDenied):
            self.record(project=self.project, client=self.other_client)

    def test_enforces_manual_category_rules_and_project_client_consistency(self):
        income = self.record(direction=LedgerEntry.Direction.INCOME, category=None, client=None)
        self.assertIsNone(income.category_id)
        with self.assertRaises(LedgerAccessDenied):
            self.record(direction=LedgerEntry.Direction.INCOME)
        self.category.status = Category.Status.INACTIVE
        self.category.save()
        with self.assertRaises(LedgerAccessDenied):
            self.record()
        self.category.status = Category.Status.ACTIVE
        self.category.save()
        with self.assertRaises(LedgerAccessDenied):
            self.record(project=self.project, client=None)
        with self.assertRaises(LedgerAccessDenied):
            self.record(project=self.project, client=self.second_client)
        entry = self.record(project=self.project)
        self.assertEqual(entry.project_id, self.project.pk)

    def test_replays_only_the_same_semantic_request_and_excludes_generated_provenance(self):
        key = uuid4()
        first = self.record(idempotency_key=key)
        replay = self.record(idempotency_key=key, description="Taxi ride")
        self.assertEqual(replay.pk, first.pk)
        with self.assertRaises(LedgerIdempotencyConflict):
            self.record(idempotency_key=key, description="Train ride")
        operator_entry = self.record(self.operational_context, idempotency_key=uuid4())
        self.assertNotEqual(operator_entry.public_id, first.public_id)
        self.assertNotEqual(operator_entry.created_by_id, first.created_by_id)
        self.assertEqual(operator_entry.request_fingerprint, first.request_fingerprint)

    def test_integrity_error_refetches_persisted_entry_only_for_same_semantic_payload(self):
        key = uuid4()
        persisted = self.record(idempotency_key=key)
        original_entry_for_key = ledger_services._entry_for_key
        lookups = 0

        def simulate_racing_lookup(workspace, idempotency_key):
            nonlocal lookups
            lookups += 1
            if lookups in (1, 3):
                return None
            return original_entry_for_key(workspace, idempotency_key)

        with (
            patch("ledger.services._entry_for_key", side_effect=simulate_racing_lookup) as entry_for_key,
            patch.object(
                LedgerEntry,
                "save",
                autospec=True,
                side_effect=IntegrityError("duplicate idempotency key"),
            ) as save,
        ):
            recovered = self.record(idempotency_key=key, description="Taxi ride")
            self.assertEqual(recovered.pk, persisted.pk)
            self.assertEqual(LedgerEntry.objects.filter(idempotency_key=key).count(), 1)
            with self.assertRaises(LedgerIdempotencyConflict):
                self.record(idempotency_key=key, description="Train ride")

        self.assertEqual(save.call_count, 2)
        self.assertEqual(
            entry_for_key.call_args_list,
            [call(self.workspace, key), call(self.workspace, key)] * 2,
        )

    def test_exposes_context_scoped_reads_and_no_caller_owned_write_fields(self):
        entry = self.record()
        self.assertEqual(list(get_ledger_entries(self.context)), [entry])
        self.assertEqual(list(get_ledger_entries(self.other_context)), [])
        parameters = signature(record_manual_entry).parameters
        self.assertFalse({"workspace", "created_by", "source", "category_name_snapshot", "category_deductible_snapshot"} & parameters.keys())
        with self.assertRaises(TypeError):
            self.record(source=LedgerEntry.Source.REVERSAL)
        with self.assertRaises((TypeError, ValueError)):
            self.record(idempotency_key="not-a-uuid")
