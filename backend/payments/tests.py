from pathlib import Path

from django.test import TestCase

from payments.models import Payment


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
