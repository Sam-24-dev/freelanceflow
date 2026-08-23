import importlib
from datetime import date
from decimal import Decimal
from unittest.mock import Mock
from uuid import uuid4

from django.core.exceptions import ValidationError
from django.db import DatabaseError, connection, transaction
from django.test import SimpleTestCase, TestCase, TransactionTestCase

from accounts.models import User
from categories.models import Category
from clients.models import Client
from ledger.models import LedgerEntry, _ledger_service_write_boundary, calculate_request_fingerprint
from projects.services import convert_accepted_proposal
from proposals.models import Proposal
from proposals.services import add_line_item, create_proposal, send_proposal, transition_proposal
from workspaces.context import ActiveWorkspaceContext
from workspaces.models import Membership
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
