from django.db import migrations


INVOICE_TOTAL_SQL = """
    COALESCE(
        SUM(
            ROUND(
                ROUND(line_item.quantity * line_item.unit_rate, 2)
                + ROUND(ROUND(line_item.quantity * line_item.unit_rate, 2) * line_item.vat_rate / 100, 2)
                - ROUND(ROUND(line_item.quantity * line_item.unit_rate, 2) * line_item.withholding_rate / 100, 2),
                2
            )
        ),
        0.00
    )
"""


class Migration(migrations.Migration):

    dependencies = [("payments", "0001_initial")]

    operations = [
        migrations.RunSQL(sql="DROP TRIGGER IF EXISTS payment_validate_insert", reverse_sql=None),
        migrations.RunSQL(
            sql="""
                CREATE TRIGGER payment_validate_insert
                BEFORE INSERT ON payments_payment
                FOR EACH ROW
                BEGIN
                    DECLARE locked_invoice BIGINT;
                    DECLARE invoice_workspace BIGINT;
                    DECLARE invoice_status VARCHAR(10);
                    DECLARE invoice_number VARCHAR(20);
                    DECLARE invoice_total DECIMAL(18,2);
                    DECLARE active_paid DECIMAL(18,2);

                    SELECT id, workspace_id, status, number
                    INTO locked_invoice, invoice_workspace, invoice_status, invoice_number
                    FROM invoices_invoice
                    WHERE id = NEW.invoice_id
                    FOR UPDATE;

                    IF locked_invoice IS NULL OR NEW.workspace_id <> invoice_workspace
                       OR invoice_status <> 'ISSUED' OR NEW.currency <> 'USD'
                       OR NEW.invoice_currency_snapshot <> 'USD'
                       OR NEW.amount <= 0 OR CHAR_LENGTH(TRIM(NEW.source_type)) = 0
                       OR CHAR_LENGTH(TRIM(NEW.source_reference)) = 0
                       OR NEW.invoice_number_snapshot <> invoice_number THEN
                        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Payment ledger entry is invalid.';
                    END IF;

                    SELECT """ + INVOICE_TOTAL_SQL + """
                    INTO invoice_total
                    FROM invoices_invoicelineitem AS line_item
                    WHERE line_item.invoice_id = NEW.invoice_id;

                    SELECT COALESCE(SUM(payment.amount), 0.00)
                    INTO active_paid
                    FROM payments_payment AS payment
                    WHERE payment.invoice_id = NEW.invoice_id
                      AND NOT EXISTS (
                          SELECT 1 FROM payments_paymentreversal AS reversal
                          WHERE reversal.payment_id = payment.id
                      );

                    IF NEW.invoice_total_snapshot <> invoice_total
                       OR NEW.amount + active_paid > invoice_total THEN
                        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Payment exceeds the issued invoice total.';
                    END IF;
                END
            """,
            reverse_sql=None,
        ),
        migrations.RunSQL(sql="DROP TRIGGER IF EXISTS payment_reversal_validate_insert", reverse_sql=None),
        migrations.RunSQL(
            sql="""
                CREATE TRIGGER payment_reversal_validate_insert
                BEFORE INSERT ON payments_paymentreversal
                FOR EACH ROW
                BEGIN
                    DECLARE locked_invoice BIGINT;
                    DECLARE invoice_workspace BIGINT;
                    DECLARE invoice_status VARCHAR(10);
                    DECLARE locked_payment BIGINT;
                    DECLARE payment_workspace BIGINT;
                    DECLARE payment_invoice BIGINT;
                    DECLARE payment_amount DECIMAL(18,2);
                    DECLARE payment_currency VARCHAR(3);
                    DECLARE payment_number VARCHAR(20);
                    DECLARE payment_total DECIMAL(18,2);
                    DECLARE existing_reversal INT;

                    SELECT id, workspace_id, status
                    INTO locked_invoice, invoice_workspace, invoice_status
                    FROM invoices_invoice
                    WHERE id = NEW.invoice_id
                    FOR UPDATE;
                    SELECT id, workspace_id, invoice_id, amount, currency,
                           invoice_number_snapshot, invoice_total_snapshot
                    INTO locked_payment, payment_workspace, payment_invoice, payment_amount,
                         payment_currency, payment_number, payment_total
                    FROM payments_payment
                    WHERE id = NEW.payment_id
                    FOR UPDATE;
                    SELECT COUNT(*) INTO existing_reversal
                    FROM payments_paymentreversal
                    WHERE payment_id = NEW.payment_id;

                    IF locked_invoice IS NULL OR locked_payment IS NULL
                       OR invoice_status <> 'ISSUED' OR NEW.workspace_id <> invoice_workspace
                       OR payment_workspace <> NEW.workspace_id OR payment_invoice <> NEW.invoice_id
                       OR NEW.currency <> 'USD' OR NEW.invoice_currency_snapshot <> 'USD'
                       OR NEW.amount <= 0 OR NEW.amount <> payment_amount
                       OR NEW.currency <> payment_currency OR CHAR_LENGTH(TRIM(NEW.reason)) = 0
                       OR NEW.invoice_number_snapshot <> payment_number
                       OR NEW.invoice_total_snapshot <> payment_total OR existing_reversal <> 0 THEN
                        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Payment reversal is invalid.';
                    END IF;
                END
            """,
            reverse_sql=None,
        ),
    ]