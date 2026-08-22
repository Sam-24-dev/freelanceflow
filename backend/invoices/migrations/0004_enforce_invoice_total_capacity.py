from django.db import migrations


PAYMENT_TOTAL_MAX = "9999999999999999.99"
LINE_TOTAL_SQL = """
    ROUND(
        ROUND(quantity * unit_rate, 2)
        + ROUND(ROUND(quantity * unit_rate, 2) * vat_rate / 100, 2)
        - ROUND(ROUND(quantity * unit_rate, 2) * withholding_rate / 100, 2),
        2
    )
"""
NEW_LINE_TOTAL_SQL = """
    ROUND(
        ROUND(NEW.quantity * NEW.unit_rate, 2)
        + ROUND(ROUND(NEW.quantity * NEW.unit_rate, 2) * NEW.vat_rate / 100, 2)
        - ROUND(ROUND(NEW.quantity * NEW.unit_rate, 2) * NEW.withholding_rate / 100, 2),
        2
    )
"""


def validate_existing_invoice_total_capacity(apps, schema_editor):
    """Fail closed before installing the capacity trigger over historical rows."""
    with schema_editor.connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT totals.invoice_id, totals.invoice_total
            FROM (
                SELECT invoice.id AS invoice_id,
                       CAST(
                           COALESCE(
                               SUM(
                                   CAST(
                                       ROUND(
                                           ROUND(line_item.quantity * line_item.unit_rate, 2)
                                           + ROUND(ROUND(line_item.quantity * line_item.unit_rate, 2) * line_item.vat_rate / 100, 2)
                                           - ROUND(ROUND(line_item.quantity * line_item.unit_rate, 2) * line_item.withholding_rate / 100, 2),
                                           2
                                       ) AS DECIMAL(65,2)
                                   )
                               ),
                               CAST(0.00 AS DECIMAL(65,2))
                           ) AS DECIMAL(65,2)
                       ) AS invoice_total
                FROM invoices_invoice AS invoice
                INNER JOIN invoices_invoicelineitem AS line_item
                    ON line_item.invoice_id = invoice.id
                WHERE invoice.status IN ('DRAFT', 'ISSUING', 'ISSUED')
                GROUP BY invoice.id
            ) AS totals
            WHERE totals.invoice_total > %s
            ORDER BY totals.invoice_id
            LIMIT 1
            """,
            [PAYMENT_TOTAL_MAX],
        )
        oversized = cursor.fetchone()
    if oversized is not None:
        invoice_id, invoice_total = oversized
        raise RuntimeError(
            "Cannot enforce invoice payment ledger capacity: "
            f"invoice {invoice_id} has total {invoice_total}."
        )


class Migration(migrations.Migration):

    dependencies = [
        ("invoices", "0003_block_void_with_active_payments"),
        ("payments", "0002_enforce_trimmed_text_contract"),
    ]

    operations = [
        migrations.RunPython(
            validate_existing_invoice_total_capacity,
            migrations.RunPython.noop,
        ),
        migrations.RunSQL(sql="DROP TRIGGER IF EXISTS invoice_line_validate_insert", reverse_sql=None),
        migrations.RunSQL(
            sql="""
                CREATE TRIGGER invoice_line_validate_insert
                BEFORE INSERT ON invoices_invoicelineitem
                FOR EACH ROW
                BEGIN
                    DECLARE invoice_status VARCHAR(10);
                    DECLARE invoice_vat BOOLEAN;
                    DECLARE invoice_vat_rate DECIMAL(5,2);
                    DECLARE invoice_withholding_rate DECIMAL(5,2);
                    DECLARE source_count INT;
                    DECLARE existing_total DECIMAL(65,2);
                    DECLARE new_line_total DECIMAL(65,2);

                    SELECT status, fiscal_applies_vat, fiscal_vat_rate,
                           fiscal_withholding_rate
                    INTO invoice_status, invoice_vat, invoice_vat_rate,
                         invoice_withholding_rate
                    FROM invoices_invoice
                    WHERE id = NEW.invoice_id;
                    SELECT COUNT(*) INTO source_count
                    FROM proposals_proposallineitem AS source_line
                    INNER JOIN projects_project AS project
                        ON project.proposal_id = source_line.proposal_id
                    INNER JOIN invoices_invoice AS invoice
                        ON invoice.project_id = project.id
                    WHERE invoice.id = NEW.invoice_id
                      AND source_line.position = NEW.position
                      AND source_line.service_name <=> NEW.service_name
                      AND source_line.description <=> NEW.description
                      AND source_line.unit_of_measure <=> NEW.unit_of_measure
                      AND source_line.quantity <=> NEW.quantity
                      AND source_line.unit_rate <=> NEW.unit_rate
                      AND source_line.currency <=> NEW.currency;

                    IF invoice_status IS NULL OR invoice_status <> 'ISSUING'
                       OR source_count <> 1 OR NEW.currency <> 'USD'
                       OR NEW.vat_rate < 0 OR NEW.vat_rate > 100
                       OR NEW.withholding_rate < 0 OR NEW.withholding_rate > 100
                       OR NOT (NEW.vat_rate <=> IF(invoice_vat, invoice_vat_rate, 0.00))
                       OR NOT (NEW.withholding_rate <=> invoice_withholding_rate) THEN
                        SIGNAL SQLSTATE '45000'
                            SET MESSAGE_TEXT = 'Invoice line snapshot is invalid.';
                    END IF;

                    SET new_line_total = CAST(""" + NEW_LINE_TOTAL_SQL + """ AS DECIMAL(65,2));
                    SELECT COALESCE(
                        SUM(
                            CAST(
                                ROUND(
                                    ROUND(line_item.quantity * line_item.unit_rate, 2)
                                    + ROUND(ROUND(line_item.quantity * line_item.unit_rate, 2) * line_item.vat_rate / 100, 2)
                                    - ROUND(ROUND(line_item.quantity * line_item.unit_rate, 2) * line_item.withholding_rate / 100, 2),
                                    2
                                ) AS DECIMAL(65,2)
                            )
                        ),
                        CAST(0.00 AS DECIMAL(65,2))
                    ) INTO existing_total
                    FROM invoices_invoicelineitem AS line_item
                    WHERE line_item.invoice_id = NEW.invoice_id;

                    IF new_line_total > """ + PAYMENT_TOTAL_MAX + """
                       OR existing_total + new_line_total > """ + PAYMENT_TOTAL_MAX + """ THEN
                        SIGNAL SQLSTATE '45000'
                            SET MESSAGE_TEXT = 'Invoice total exceeds the payment ledger capacity.';
                    END IF;
                END
            """,
            reverse_sql=None,
        ),
    ]
