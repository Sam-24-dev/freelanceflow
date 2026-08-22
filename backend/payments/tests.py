from datetime import date
from decimal import Decimal
from pathlib import Path
from uuid import uuid4

from django.test import TestCase, TransactionTestCase
from django.utils import timezone

from accounts.models import User
from clients.models import Client
from fiscal.services import create_fiscal_configuration
from invoices.services import create_draft_invoice, issue_invoice
from payments.models import Payment, PaymentReversal
from payments.services import (
    PaymentIdempotencyConflict,
    PaymentValidationError,
    record_payment,
    reverse_payment,
)
from projects.services import convert_accepted_proposal
from proposals.models import Proposal
from proposals.services import add_line_item, create_proposal, send_proposal, transition_proposal
from workspaces.context import ActiveWorkspaceContext
from workspaces.models import Membership
from workspaces.services import create_workspace_with_owner


class PaymentDirectSqlLockingProofContractTests(TestCase):
    def test_declares_the_required_direct_sql_trigger_locking_proof(self) -> None:
        self.assertEqual(
            Payment.direct_sql_trigger_locking_proof_contract(),
            {
                "mysql_version": "8.4",
                "trigger_locking_read": "SELECT ... FOR UPDATE",
                "proof_cases": (
                    "payment_vs_void",
                    "reversal_vs_void",
                    "raw_overpayment",
                ),
                "inspect_trigger_ddl": True,
            },
        )

    def test_payment_migration_contains_locked_trigger_proof_primitives(self):
        sql = (Path(__file__).with_name("migrations") / "0001_initial.py").read_text(
            encoding="utf-8"
        )
        self.assertIn("SELECT id, workspace_id, status, number", sql)
        self.assertIn("FOR UPDATE", sql)
        self.assertIn("ROUND(ROUND(line_item.quantity * line_item.unit_rate, 2)", sql)
        self.assertIn("NOT EXISTS", sql)

class PaymentLedgerServiceTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(email="payment-owner@example.com", password="password")
        self.workspace = create_workspace_with_owner(owner=self.owner, name="Payments", slug="payments")
        self.context = ActiveWorkspaceContext(
            self.workspace, Membership.objects.get(workspace=self.workspace, user=self.owner)
        )
        self.client = Client.objects.create(
            workspace=self.workspace,
            legal_name="Payment Client",
            client_type=Client.ClientType.COMPANY,
            tax_identifier="PAY-1",
            primary_contact_name="Contact",
            primary_contact_email="payment-client@example.com",
        )

    def _issued_invoice(self):
        proposal = create_proposal(self.context, self.client, "Payment source", date.today(), date.today())
        add_line_item(
            self.context, proposal, position=1, service_name="Payment work",
            description="Frozen scope", unit_of_measure="HOUR", quantity=Decimal("1.00"),
            unit_rate=Decimal("100.00"),
        )
        proposal = transition_proposal(
            self.context, send_proposal(self.context, proposal), Proposal.Status.ACCEPTED
        )
        project = convert_accepted_proposal(self.context, proposal)
        create_fiscal_configuration(
            self.context, legal_name="Payments LLC", tax_identifier="PAY-TAX", tax_regime="GENERAL",
            applies_vat=False, vat_rate=Decimal("0.00"), withholding_rate=Decimal("0.00"),
        )
        return issue_invoice(self.context, create_draft_invoice(self.context, project))

    def _payment(self, invoice, *, amount=Decimal("10.00"), key=None, reference="receipt-1"):
        return record_payment(
            self.context, invoice, amount=amount, idempotency_key=key or uuid4(),
            source_type=" bank_transfer ", source_reference=reference, received_at=timezone.now(),
        )

    def test_records_partial_payments_and_rejects_overpayment(self):
        invoice = self._issued_invoice()
        first = self._payment(invoice, amount=Decimal("40.00"), reference="A")
        second = self._payment(invoice, amount=Decimal("60.00"), reference="B")
        self.assertEqual(first.source_type, "BANK_TRANSFER")
        self.assertEqual(Payment.objects.filter(invoice=invoice).count(), 2)
        with self.assertRaises(PaymentValidationError):
            self._payment(invoice, amount=Decimal("0.01"), reference="over")
        self.assertEqual(second.invoice_total_snapshot, Decimal("100.00"))

    def test_reversal_is_full_only_and_restores_payable_balance(self):
        invoice = self._issued_invoice()
        payment = self._payment(invoice, amount=Decimal("100.00"))
        with self.assertRaises(PaymentValidationError):
            reverse_payment(self.context, invoice, payment, idempotency_key=uuid4(), reason="bad", amount=Decimal("99.99"))
        reversal = reverse_payment(self.context, invoice, payment, idempotency_key=uuid4(), reason="returned")
        self.assertEqual(PaymentReversal.objects.get(payment=payment), reversal)
        self.assertEqual(self._payment(invoice, amount=Decimal("100.00"), reference="replacement").amount, Decimal("100.00"))

    def test_idempotency_retries_identical_request_and_rejects_conflict(self):
        invoice = self._issued_invoice()
        key = uuid4()
        received_at = timezone.now()
        created = record_payment(
            self.context, invoice, amount=Decimal("10.00"), idempotency_key=key,
            source_type="cash", source_reference="receipt", received_at=received_at,
        )
        self.assertEqual(
            record_payment(
                self.context, invoice, amount=Decimal("10.00"), idempotency_key=key,
                source_type="cash", source_reference="receipt", received_at=received_at,
            ).pk,
            created.pk,
        )
        with self.assertRaises(PaymentIdempotencyConflict):
            record_payment(
                self.context, invoice, amount=Decimal("10.00"), idempotency_key=key,
                source_type="cash", source_reference="different", received_at=received_at,
            )


class ImmutableTriggerRunnerContractTests(TestCase):
    def test_parent_marker_cannot_authenticate_child_mode(self):
        from config.test_runner import is_authenticated_isolated_child
        self.assertFalse(is_authenticated_isolated_child({"FREELANCEFLOW_ISOLATED_IMMUTABLE_TRIGGER_TEST": "1"}))

    def test_runner_identifies_raw_transaction_cases(self):
        from config.test_runner import is_flush_unsafe_transaction_test
        self.assertFalse(is_flush_unsafe_transaction_test(self))
        self.assertTrue(is_flush_unsafe_transaction_test(TransactionTestCase("runTest")))


class PaymentTriggerTextContractTests(TestCase):
    def test_trimmed_text_migration_replaces_blank_checks(self):
        sql = (Path(__file__).with_name("migrations") / "0002_enforce_trimmed_text_contract.py").read_text(encoding="utf-8")
        self.assertIn("CHAR_LENGTH(TRIM(NEW.source_type))", sql)
        self.assertIn("CHAR_LENGTH(TRIM(NEW.source_reference))", sql)
        self.assertIn("CHAR_LENGTH(TRIM(NEW.reason))", sql)
