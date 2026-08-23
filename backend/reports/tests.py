from datetime import date, datetime, timezone as datetime_timezone
from decimal import Decimal
from uuid import uuid4
from zoneinfo import ZoneInfo

from django.test import TestCase
from django.utils import timezone

from accounts.models import User
from categories.models import Category
from clients.models import Client
from fiscal.services import create_fiscal_configuration
from invoices.services import create_draft_invoice, issue_invoice
from ledger.models import LedgerEntry
from ledger.services import record_manual_entry, reverse_manual_entry
from payments.models import Payment, PaymentReversal
from payments.services import record_payment, reverse_payment
from projects.services import convert_accepted_proposal
from proposals.models import Proposal
from proposals.services import add_line_item, create_proposal, send_proposal, transition_proposal
from workspaces.context import ActiveWorkspaceContext
from workspaces.models import Membership, allow_membership_writes
from workspaces.services import create_workspace_with_owner

from reports.services import CashActivityAccessDenied, get_cash_activity_report


UTC = datetime_timezone.utc
GUAYAQUIL = ZoneInfo("America/Guayaquil")


class CashActivityReportTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(email="reports-owner@example.com", password="password")
        self.workspace = create_workspace_with_owner(owner=self.owner, name="Reports", slug="reports")
        self.context = ActiveWorkspaceContext(
            self.workspace,
            Membership.objects.get(workspace=self.workspace, user=self.owner),
        )
        self.client = Client.objects.create(
            workspace=self.workspace,
            legal_name="Report Client",
            client_type=Client.ClientType.COMPANY,
            tax_identifier="REPORT-1",
            primary_contact_name="Contact",
            primary_contact_email="report-client@example.com",
        )
        self.category = Category.objects.create(
            workspace=self.workspace,
            name="Software",
            default_deductible=True,
        )

    def _issued_invoice(self):
        proposal = create_proposal(self.context, self.client, "Report source", date.today(), date.today())
        add_line_item(
            self.context,
            proposal,
            position=1,
            service_name="Reporting work",
            description="Frozen scope",
            unit_of_measure="HOUR",
            quantity=Decimal("1.00"),
            unit_rate=Decimal("100.00"),
        )
        proposal = transition_proposal(
            self.context,
            send_proposal(self.context, proposal),
            Proposal.Status.ACCEPTED,
        )
        project = convert_accepted_proposal(self.context, proposal)
        create_fiscal_configuration(
            self.context,
            legal_name="Reports LLC",
            tax_identifier="REPORT-TAX",
            tax_regime="GENERAL",
            applies_vat=False,
            vat_rate=Decimal("0.00"),
            withholding_rate=Decimal("0.00"),
        )
        return issue_invoice(self.context, create_draft_invoice(self.context, project))

    def _record_payment(self, invoice, *, amount, received_at):
        return record_payment(
            self.context,
            invoice,
            amount=amount,
            idempotency_key=uuid4(),
            source_type="CASH",
            source_reference=uuid4().hex,
            received_at=received_at,
        )

    def _record_expense(self, *, amount, occurred_on=date(2026, 5, 1), client=None, project=None, category=None):
        return record_manual_entry(
            self.context,
            idempotency_key=uuid4(),
            direction=LedgerEntry.Direction.EXPENSE,
            amount=amount,
            occurred_on=occurred_on,
            description="Report expense",
            category=category or self.category,
            client=client,
            project=project,
        )

    def _report(self, start=date(2026, 5, 1), end=date(2026, 5, 31), context=None):
        return get_cash_activity_report(context or self.context, start_date=start, end_date=end)

    def test_requires_an_active_workspace_context_and_has_no_superuser_bypass(self):
        with self.assertRaises(CashActivityAccessDenied):
            get_cash_activity_report(object(), start_date=date(2026, 5, 1), end_date=date(2026, 5, 1))

        superuser = User.objects.create_superuser(email="reports-root@example.com", password="password")
        super_context = ActiveWorkspaceContext(
            self.workspace,
            Membership.objects.create(
                workspace=self.workspace,
                user=superuser,
                role=Membership.Role.ADMINISTRATIVE,
            ),
        )
        with self.assertRaises(CashActivityAccessDenied):
            self._report(context=super_context)

    def test_denies_administrative_revoked_and_inactive_memberships(self):
        administrative = User.objects.create_user(email="reports-admin@example.com", password="password")
        administrative_context = ActiveWorkspaceContext(
            self.workspace,
            Membership.objects.create(
                workspace=self.workspace,
                user=administrative,
                role=Membership.Role.ADMINISTRATIVE,
            ),
        )
        with self.assertRaises(CashActivityAccessDenied):
            self._report(context=administrative_context)

        inactive = User.objects.create_user(email="reports-inactive@example.com", password="password")
        inactive_context = ActiveWorkspaceContext(
            self.workspace,
            Membership.objects.create(
                workspace=self.workspace,
                user=inactive,
                role=Membership.Role.OPERATIONAL,
            ),
        )
        inactive.is_active = False
        inactive.save(update_fields=["is_active"])
        with self.assertRaises(CashActivityAccessDenied):
            self._report(context=inactive_context)

        revoked = User.objects.create_user(email="reports-revoked@example.com", password="password")
        revoked_membership = Membership.objects.create(
            workspace=self.workspace,
            user=revoked,
            role=Membership.Role.OPERATIONAL,
        )
        revoked_context = ActiveWorkspaceContext(self.workspace, revoked_membership)
        with allow_membership_writes():
            revoked_membership.delete()
        with self.assertRaises(CashActivityAccessDenied):
            self._report(context=revoked_context)

    def test_isolates_workspace_and_never_writes_source_events(self):
        invoice = self._issued_invoice()
        payment = self._record_payment(
            invoice,
            amount=Decimal("10.00"),
            received_at=datetime(2026, 5, 1, 12, tzinfo=UTC),
        )

        other_owner = User.objects.create_user(email="reports-other@example.com", password="password")
        other_workspace = create_workspace_with_owner(owner=other_owner, name="Other Reports", slug="other-reports")
        other_context = ActiveWorkspaceContext(
            other_workspace,
            Membership.objects.get(workspace=other_workspace, user=other_owner),
        )
        other_category = Category.objects.create(workspace=other_workspace, name="Other", default_deductible=True)
        record_manual_entry(
            other_context,
            idempotency_key=uuid4(),
            direction=LedgerEntry.Direction.EXPENSE,
            amount=Decimal("99.99"),
            occurred_on=date(2026, 5, 1),
            description="Other workspace event",
            category=other_category,
        )
        before = {
            "ledger": list(LedgerEntry.objects.values_list("pk", "amount", "created_at")),
            "payments": list(Payment.objects.values_list("pk", "amount", "received_at")),
            "reversals": list(PaymentReversal.objects.values_list("pk", "amount", "reversed_at")),
        }

        report = self._report()

        self.assertEqual(report.cash_in, Decimal("10.00"))
        self.assertEqual(report.cash_out, Decimal("0.00"))
        self.assertEqual(report.net, Decimal("10.00"))
        self.assertEqual(before["ledger"], list(LedgerEntry.objects.values_list("pk", "amount", "created_at")))
        self.assertEqual(before["payments"], list(Payment.objects.values_list("pk", "amount", "received_at")))
        self.assertEqual(before["reversals"], list(PaymentReversal.objects.values_list("pk", "amount", "reversed_at")))
        self.assertEqual(payment.workspace_id, self.workspace.pk)

    def test_applies_inclusive_ledger_and_guayaquil_payment_boundaries(self):
        self._record_expense(amount=Decimal("2.00"), occurred_on=date(2026, 5, 1))
        self._record_expense(amount=Decimal("3.00"), occurred_on=date(2026, 5, 31))
        invoice = self._issued_invoice()
        self._record_payment(
            invoice,
            amount=Decimal("10.00"),
            received_at=datetime(2026, 5, 2, 2, 30, tzinfo=UTC),  # May 1 in Guayaquil.
        )
        self._record_payment(
            invoice,
            amount=Decimal("20.00"),
            received_at=datetime(2026, 6, 1, 4, 30, tzinfo=UTC),  # May 31 in Guayaquil.
        )

        report = self._report()

        self.assertEqual(report.cash_in, Decimal("30.00"))
        self.assertEqual(report.cash_out, Decimal("5.00"))
        self.assertEqual(report.net, Decimal("25.00"))

    def test_receipt_and_later_reversal_are_separate_dated_cash_events(self):
        invoice = self._issued_invoice()
        payment = self._record_payment(
            invoice,
            amount=Decimal("10.00"),
            received_at=datetime(2026, 5, 2, 2, 30, tzinfo=UTC),
        )
        reverse_payment(
            self.context,
            invoice,
            payment,
            idempotency_key=uuid4(),
            reason="Returned",
            reversed_at=datetime(2026, 5, 3, 5, 30, tzinfo=UTC),
        )

        receipt_day = self._report(date(2026, 5, 1), date(2026, 5, 1))
        reversal_day = self._report(date(2026, 5, 3), date(2026, 5, 3))

        self.assertEqual((receipt_day.cash_in, receipt_day.cash_out), (Decimal("10.00"), Decimal("0.00")))
        self.assertEqual((reversal_day.cash_in, reversal_day.cash_out), (Decimal("0.00"), Decimal("10.00")))

    def test_ledger_reversal_keeps_its_stored_signed_direction(self):
        entry = self._record_expense(amount=Decimal("4.50"), occurred_on=date(2026, 5, 10))
        reversal = reverse_manual_entry(self.context, idempotency_key=uuid4(), entry_public_id=entry.public_id)

        report = self._report(date(2026, 5, 10), date(2026, 5, 10))

        self.assertEqual(reversal.direction, LedgerEntry.Direction.INCOME)
        self.assertEqual((report.cash_in, report.cash_out, report.net), (Decimal("4.50"), Decimal("4.50"), Decimal("0.00")))

    def test_returns_exact_decimal_cents_without_float_math(self):
        invoice = self._issued_invoice()
        self._record_payment(invoice, amount=Decimal("0.10"), received_at=datetime(2026, 5, 10, 12, tzinfo=UTC))
        self._record_payment(invoice, amount=Decimal("0.20"), received_at=datetime(2026, 5, 10, 12, 1, tzinfo=UTC))

        report = self._report(date(2026, 5, 10), date(2026, 5, 10))

        self.assertEqual(report.cash_in, Decimal("0.30"))
        self.assertIsInstance(report.cash_in, Decimal)
        self.assertIsInstance(report.cash_out, Decimal)
        self.assertIsInstance(report.net, Decimal)

    def test_groups_only_source_supported_facts_and_excludes_other_workspaces(self):
        invoice = self._issued_invoice()
        payment = self._record_payment(invoice, amount=Decimal("10.00"), received_at=datetime(2026, 5, 10, 12, tzinfo=UTC))
        self._record_expense(
            amount=Decimal("2.00"),
            occurred_on=date(2026, 5, 10),
            client=invoice.client,
            project=invoice.project,
            category=self.category,
        )
        other_owner = User.objects.create_user(email="reports-group-other@example.com", password="password")
        other_workspace = create_workspace_with_owner(owner=other_owner, name="Other Group", slug="other-group")
        other_context = ActiveWorkspaceContext(other_workspace, Membership.objects.get(workspace=other_workspace, user=other_owner))
        other_category = Category.objects.create(workspace=other_workspace, name="Other Group Category", default_deductible=True)
        record_manual_entry(
            other_context,
            idempotency_key=uuid4(),
            direction=LedgerEntry.Direction.EXPENSE,
            amount=Decimal("50.00"),
            occurred_on=date(2026, 5, 10),
            description="Other group",
            category=other_category,
        )

        report = self._report(date(2026, 5, 10), date(2026, 5, 10))

        self.assertEqual([(item.key, item.cash_in, item.cash_out) for item in report.by_client], [(invoice.client.public_id, Decimal("10.00"), Decimal("2.00"))])
        self.assertEqual([(item.key, item.cash_in, item.cash_out) for item in report.by_project], [(invoice.project.public_id, Decimal("10.00"), Decimal("2.00"))])
        self.assertEqual([(item.key, item.cash_in, item.cash_out) for item in report.by_category], [(self.category.public_id, Decimal("0.00"), Decimal("2.00"))])
        self.assertEqual(payment.workspace_id, self.workspace.pk)

    def test_returns_zero_totals_and_metadata_for_empty_range(self):
        report = self._report(date(2026, 6, 1), date(2026, 6, 30))

        self.assertEqual((report.cash_in, report.cash_out, report.net), (Decimal("0.00"), Decimal("0.00"), Decimal("0.00")))
        self.assertEqual((report.start_date, report.end_date), (date(2026, 6, 1), date(2026, 6, 30)))
        self.assertEqual(report.timezone, "America/Guayaquil")
        self.assertTrue(timezone.is_aware(report.as_of))
        self.assertEqual(report.by_client, ())
        self.assertEqual(report.by_project, ())
        self.assertEqual(report.by_category, ())