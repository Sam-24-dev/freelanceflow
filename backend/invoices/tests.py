from datetime import date
from decimal import Decimal
from pathlib import Path
from uuid import uuid4
from queue import Queue
from threading import Barrier, Thread
from traceback import format_exc
from unittest.mock import patch

from django.core.exceptions import ValidationError
from django.db import DatabaseError, connection, close_old_connections, transaction
from django.db.models.deletion import ProtectedError
from django.test import TestCase, TransactionTestCase
from django.utils import timezone

from accounts.models import User
from clients.models import Client
from fiscal.services import create_fiscal_configuration
from invoices.models import Invoice, InvoiceLineItem, InvoiceSequence
from invoices.services import InvoiceAccessDenied, InvoiceTransitionError, create_draft_invoice, issue_invoice, void_invoice
from payments.services import record_payment, reverse_payment
from projects.services import convert_accepted_proposal
from proposals.models import Proposal
from proposals.services import add_line_item, create_proposal, send_proposal, transition_proposal
from workspaces.context import ActiveWorkspaceContext
from workspaces.models import Membership
from workspaces.services import create_workspace_with_owner


class InvoiceDomainTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(email="invoice-owner@example.com", password="password")
        self.workspace = create_workspace_with_owner(owner=self.owner, name="Invoice One", slug="invoice-one")
        self.context = ActiveWorkspaceContext(self.workspace, Membership.objects.get(workspace=self.workspace, user=self.owner))
        self.client = Client.objects.create(workspace=self.workspace, legal_name="Client", client_type=Client.ClientType.COMPANY, tax_identifier="INV-1", primary_contact_name="Contact", primary_contact_email="client@example.com")
        self.other_owner = User.objects.create_user(email="invoice-other@example.com", password="password")
        self.other_workspace = create_workspace_with_owner(owner=self.other_owner, name="Invoice Two", slug="invoice-two")
        self.other_context = ActiveWorkspaceContext(self.other_workspace, Membership.objects.get(workspace=self.other_workspace, user=self.other_owner))
        self.other_client = Client.objects.create(workspace=self.other_workspace, legal_name="Other Client", client_type=Client.ClientType.COMPANY, tax_identifier="INV-2", primary_contact_name="Contact", primary_contact_email="other@example.com")

    def _project(self, *, quantity=Decimal("1.00"), rate=Decimal("100.00"), other=False):
        context, client = (self.other_context, self.other_client) if other else (self.context, self.client)
        proposal = create_proposal(context, client, "Invoice source", date.today(), date.today())
        add_line_item(context, proposal, position=1, service_name="Design", description="Frozen scope", unit_of_measure="HOUR", quantity=quantity, unit_rate=rate)
        proposal = send_proposal(context, proposal)
        proposal = transition_proposal(context, proposal, Proposal.Status.ACCEPTED)
        return convert_accepted_proposal(context, proposal)

    def _fiscal(self, *, vat=Decimal("15.00"), withholding=Decimal("0.00")):
        return create_fiscal_configuration(self.context, legal_name="Acme LLC", tax_identifier="EC-1", tax_regime="GENERAL", applies_vat=True, vat_rate=vat, withholding_rate=withholding)

    def _set_issuing_by_sql(self, invoice, fiscal):
        with connection.cursor() as cursor:
            cursor.execute(
                """
                UPDATE invoices_invoice
                SET status = 'ISSUING', number = 'INV-999999', fiscal_configuration_id = %s,
                    fiscal_version = %s, fiscal_legal_name = %s, fiscal_tax_identifier = %s,
                    fiscal_tax_regime = %s, fiscal_applies_vat = %s, fiscal_vat_rate = %s,
                    fiscal_withholding_rate = %s, issued_at = %s
                WHERE id = %s
                """,
                [
                    fiscal.pk, fiscal.version, fiscal.legal_name, fiscal.tax_identifier,
                    fiscal.tax_regime, fiscal.applies_vat, fiscal.vat_rate,
                    fiscal.withholding_rate, timezone.now(), invoice.pk,
                ],
            )

    def _assert_sql_rejected(self, sql, params):
        with self.assertRaises(DatabaseError):
            with transaction.atomic():
                with connection.cursor() as cursor:
                    cursor.execute(sql, params)

    def test_draft_derives_origin_and_has_no_fiscal_number_or_lines(self):
        draft = create_draft_invoice(self.context, self._project())
        self.assertEqual(draft.status, Invoice.Status.DRAFT)
        self.assertEqual(draft.workspace_id, self.workspace.pk)
        self.assertEqual(draft.client_id, self.client.pk)
        self.assertIsNone(draft.number)
        self.assertIsNone(draft.fiscal_configuration_id)
        self.assertEqual(draft.line_items.count(), 0)

    def test_direct_sql_cannot_issue_draft_without_the_issued_contract(self):
        draft = create_draft_invoice(self.context, self._project())
        self._assert_sql_rejected(
            "UPDATE invoices_invoice SET status = 'ISSUED' WHERE id = %s",
            [draft.pk],
        )

    def test_direct_sql_rejects_invalid_issuing_completion_and_line_snapshots(self):
        fiscal = self._fiscal()
        draft = create_draft_invoice(self.context, self._project())
        self._set_issuing_by_sql(draft, fiscal)

        self._assert_sql_rejected(
            "UPDATE invoices_invoice SET status = 'ISSUED' WHERE id = %s",
            [draft.pk],
        )
        self._assert_sql_rejected(
            "UPDATE invoices_invoice SET status = 'ISSUED', fiscal_legal_name = 'Altered' WHERE id = %s",
            [draft.pk],
        )
        self._assert_sql_rejected(
            """
            INSERT INTO invoices_invoicelineitem
                (invoice_id, position, service_name, description, unit_of_measure, quantity, unit_rate, currency, vat_rate, withholding_rate)
            VALUES (%s, 1, 'Altered', 'Frozen scope', 'HOUR', 1.00, 100.00, 'USD', 15.00, 0.00)
            """,
            [draft.pk],
        )
        self._assert_sql_rejected(
            """
            INSERT INTO invoices_invoicelineitem
                (invoice_id, position, service_name, description, unit_of_measure, quantity, unit_rate, currency, vat_rate, withholding_rate)
            VALUES (%s, 1, 'Design', 'Frozen scope', 'HOUR', 1.00, 100.00, 'USD', 14.00, 0.00)
            """,
            [draft.pk],
        )

    def test_direct_sql_cannot_void_draft_or_issuing_invoice(self):
        fiscal = self._fiscal()
        draft = create_draft_invoice(self.context, self._project())
        self._assert_sql_rejected(
            "UPDATE invoices_invoice SET status = 'VOID', voided_at = %s, void_reason = 'Invalid' WHERE id = %s",
            [timezone.now(), draft.pk],
        )
        self._set_issuing_by_sql(draft, fiscal)
        self._assert_sql_rejected(
            "UPDATE invoices_invoice SET status = 'VOID', voided_at = %s, void_reason = 'Invalid' WHERE id = %s",
            [timezone.now(), draft.pk],
        )

    def test_issue_freezes_snapshots_and_derives_decimal_amounts(self):
        self._fiscal(vat=Decimal("15.00"), withholding=Decimal("10.00"))
        issued = issue_invoice(self.context, create_draft_invoice(self.context, self._project()))
        line = issued.line_items.get()
        self.assertEqual(issued.number, "INV-000001")
        self.assertEqual((issued.fiscal_version, issued.fiscal_vat_rate), (1, Decimal("15.00")))
        self.assertEqual((line.line_subtotal, line.vat_amount, line.withholding_amount, line.line_total), (Decimal("100.00"), Decimal("15.00"), Decimal("10.00"), Decimal("105.00")))
        self.assertEqual(issued.total, Decimal("105.00"))

    def test_round_half_up_and_no_persisted_monetary_aggregates(self):
        self._fiscal(vat=Decimal("15.00"))
        issued = issue_invoice(self.context, create_draft_invoice(self.context, self._project(rate=Decimal("0.05"))))
        self.assertEqual(issued.line_items.get().vat_amount, Decimal("0.01"))
        forbidden = {"subtotal", "total", "tax_amount", "vat_amount", "withholding_amount", "line_total"}
        self.assertFalse(forbidden & {field.name for field in Invoice._meta.fields})
        self.assertFalse(forbidden & {field.name for field in InvoiceLineItem._meta.fields})

    def test_issue_is_idempotent_and_sequence_never_reuses_numbers(self):
        self._fiscal()
        first = issue_invoice(self.context, create_draft_invoice(self.context, self._project()))
        self.assertEqual(issue_invoice(self.context, first).number, "INV-000001")
        second = issue_invoice(self.context, create_draft_invoice(self.context, self._project()))
        self.assertEqual(second.number, "INV-000002")
        self.assertEqual(InvoiceSequence.objects.get(workspace=self.workspace).next_number, 3)

    def test_issue_rolls_back_sequence_header_and_lines(self):
        self._fiscal()
        draft = create_draft_invoice(self.context, self._project())
        with patch("invoices.services.InvoiceLineItem.objects.create", side_effect=RuntimeError("forced")):
            with self.assertRaisesRegex(RuntimeError, "forced"):
                issue_invoice(self.context, draft)
        draft.refresh_from_db()
        self.assertEqual(draft.status, Invoice.Status.DRAFT)
        self.assertIsNone(draft.number)
        self.assertIsNone(draft.fiscal_configuration_id)
        self.assertIsNone(draft.fiscal_version)
        self.assertEqual(draft.fiscal_legal_name, "")
        self.assertIsNone(draft.issued_at)
        self.assertEqual(draft.line_items.count(), 0)
        self.assertFalse(InvoiceSequence.objects.filter(workspace=self.workspace).exists())

    def test_issue_commits_only_the_public_issued_state(self):
        self._fiscal()
        issued = issue_invoice(self.context, create_draft_invoice(self.context, self._project()))
        self.assertEqual(issued.status, Invoice.Status.ISSUED)
        self.assertFalse(Invoice.objects.filter(status=Invoice.Status.ISSUING).exists())

    def test_roles_context_tenant_protect_and_void_without_payments(self):
        project = self._project()
        admin = User.objects.create_user(email="invoice-admin@example.com", password="password", is_superuser=True)
        membership = Membership.objects.create(workspace=self.workspace, user=admin, role=Membership.Role.ADMINISTRATIVE)
        with self.assertRaises(InvoiceAccessDenied):
            create_draft_invoice(ActiveWorkspaceContext(self.workspace, membership), project)
        outsider_membership = Membership.objects.create(workspace=self.other_workspace, user=admin, role=Membership.Role.OWNER)
        with self.assertRaises(InvoiceAccessDenied):
            create_draft_invoice(ActiveWorkspaceContext(self.workspace, outsider_membership), project)
        with self.assertRaises(InvoiceAccessDenied):
            create_draft_invoice(self.other_context, project)
        self._fiscal()
        issued = issue_invoice(self.context, create_draft_invoice(self.context, project))
        voided = void_invoice(self.context, issued, reason="Customer cancelled")
        self.assertEqual(voided.status, Invoice.Status.VOID)
        with self.assertRaises(ProtectedError):
            self.workspace.delete()

    def test_instance_manager_bulk_and_direct_sql_cannot_mutate_or_delete_issued_history(self):
        self._fiscal()
        issued = issue_invoice(self.context, create_draft_invoice(self.context, self._project()))
        with self.assertRaises(ValidationError):
            issued.delete()
        with self.assertRaises(ValidationError):
            Invoice._base_manager.filter(pk=issued.pk).update(number="INV-999999")
        with self.assertRaises(ValidationError):
            InvoiceLineItem._base_manager.bulk_update([issued.line_items.get()], ["service_name"])
        with connection.cursor() as cursor:
            with self.assertRaises(DatabaseError):
                cursor.execute("UPDATE invoices_invoice SET number = 'INV-999999' WHERE id = %s", [issued.pk])
            with self.assertRaises(DatabaseError):
                cursor.execute("DELETE FROM invoices_invoicelineitem WHERE invoice_id = %s", [issued.pk])

    def test_mysql_trigger_definitions_and_no_float_source(self):
        with connection.cursor() as cursor:
            cursor.execute("SELECT TRIGGER_NAME FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = DATABASE() AND EVENT_OBJECT_TABLE IN ('invoices_invoice', 'invoices_invoicesequence', 'invoices_invoicelineitem')")
            self.assertEqual(len(cursor.fetchall()), 9)
        self.assertNotIn("float(", open(InvoiceLineItem.__module__.replace(".", "/") + ".py", encoding="utf-8").read())


class InvoiceSequenceConcurrencyTests(TransactionTestCase):
    reset_sequences = True
    definitions = None

    def _fixture_teardown(self):
        if self.__class__.definitions is None:
            with connection.cursor() as cursor:
                cursor.execute("SELECT TRIGGER_NAME FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = DATABASE()")
                trigger_names = [row[0] for row in cursor.fetchall()]
                definitions = []
                for name in trigger_names:
                    cursor.execute("SHOW CREATE TRIGGER `{}`".format(name))
                    definitions.append(cursor.fetchone()[2])
                self.__class__.definitions = definitions
        with connection.cursor() as cursor:
            cursor.execute("SELECT TRIGGER_NAME FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = DATABASE()")
            for (name,) in cursor.fetchall():
                cursor.execute("DROP TRIGGER IF EXISTS `{}`".format(name))
        super()._fixture_teardown()
        with connection.cursor() as cursor:
            for definition in self.__class__.definitions:
                cursor.execute(definition)

    def test_concurrent_first_issues_bootstrap_one_sequence(self):
        owner = User.objects.create_user(email="concurrent-invoice@example.com", password="password")
        workspace = create_workspace_with_owner(owner=owner, name="Concurrent invoices", slug="concurrent-invoices")
        context = ActiveWorkspaceContext(workspace, Membership.objects.get(workspace=workspace, user=owner))
        client = Client.objects.create(workspace=workspace, legal_name="Client", client_type=Client.ClientType.COMPANY, tax_identifier="CONC", primary_contact_name="Contact", primary_contact_email="concurrent@example.com")
        create_fiscal_configuration(context, legal_name="Acme", tax_identifier="FISC", tax_regime="GENERAL", applies_vat=True, vat_rate=Decimal("15"), withholding_rate=Decimal("0"))
        projects = []
        for label in ("A", "B"):
            proposal = create_proposal(context, client, label, date.today(), date.today())
            add_line_item(context, proposal, position=1, service_name=label, unit_of_measure="HOUR", quantity=Decimal("1"), unit_rate=Decimal("1"))
            projects.append(convert_accepted_proposal(context, transition_proposal(context, send_proposal(context, proposal), Proposal.Status.ACCEPTED)))
        drafts = [create_draft_invoice(context, project) for project in projects]
        start, results = Barrier(2), Queue()

        def worker(invoice):
            close_old_connections()
            try:
                start.wait(timeout=10)
                results.put(issue_invoice(context, invoice).number)
            except Exception:
                results.put(format_exc())
            finally:
                close_old_connections()

        threads = [Thread(target=worker, args=(draft,)) for draft in drafts]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=30)
        self.assertFalse(any(thread.is_alive() for thread in threads))
        self.assertEqual(sorted(list(results.queue)), ["INV-000001", "INV-000002"])
        self.assertEqual(InvoiceSequence.objects.get(workspace=workspace).next_number, 3)

class InvoicePaymentVoidGuardTests(InvoiceDomainTests):
    def test_active_payment_blocks_void_until_full_reversal(self):
        self._fiscal()
        issued = issue_invoice(self.context, create_draft_invoice(self.context, self._project()))
        payment = record_payment(
            self.context, issued, amount=Decimal("100.00"), idempotency_key=uuid4(),
            source_type="cash", source_reference="receipt",
        )
        with self.assertRaises(InvoiceTransitionError):
            void_invoice(self.context, issued, reason="cancelled")
        reverse_payment(self.context, issued, payment, idempotency_key=uuid4(), reason="returned")
        self.assertEqual(void_invoice(self.context, issued, reason="cancelled").status, Invoice.Status.VOID)


class InvoicePaymentTriggerMigrationTests(TestCase):
    def test_update_trigger_preserves_0002_invariants_and_adds_active_payment_block(self):
        old_migration = (Path(__file__).with_name("migrations") / "0002_enforce_issued_update_contract.py").read_text(encoding="utf-8")
        required = (
            "Invoice origin is immutable.", "Invoice transition is invalid.",
            "Issued invoice data is immutable.", "Draft invoices cannot contain issued data.",
            "Issued invoice fiscal snapshot is invalid.", "Issued invoice line snapshots are invalid.",
            "Issued invoices cannot contain void data.", "Void invoices require a reason.",
        )
        with connection.cursor() as cursor:
            cursor.execute("SHOW CREATE TRIGGER invoice_validate_update")
            trigger = cursor.fetchone()[2]
        for invariant in required:
            self.assertIn(invariant, old_migration)
            self.assertIn(invariant, trigger)
        self.assertIn("payments_payment", trigger)
        self.assertIn("payments_paymentreversal", trigger)
        self.assertIn("Issued invoices with active payments cannot be voided.", trigger)


class InvoicePaymentCapacityTests(InvoiceDomainTests):
    def test_issuing_rejects_line_above_payment_decimal_capacity(self):
        self._fiscal(vat=Decimal("15.00"))
        draft = create_draft_invoice(
            self.context,
            self._project(quantity=Decimal("9999999999.99"), rate=Decimal("9999999999.99")),
        )
        with self.assertRaises(ValidationError):
            issue_invoice(self.context, draft)

    def test_capacity_migration_preflights_draft_issuing_and_issued_totals(self):
        sql = (Path(__file__).with_name("migrations") / "0004_enforce_invoice_total_capacity.py").read_text(encoding="utf-8")
        self.assertIn("invoice.status IN ('DRAFT', 'ISSUING', 'ISSUED')", sql)
        self.assertLess(sql.index("migrations.RunPython("), sql.index("DROP TRIGGER IF EXISTS invoice_line_validate_insert"))
        self.assertIn("DECIMAL(65,2)", sql)
