from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("invoices", "0002_enforce_issued_update_contract"),
        ("payments", "0001_initial"),
    ]

    operations = [
        migrations.RunSQL(
            sql="DROP TRIGGER IF EXISTS invoice_validate_update",
            reverse_sql=None,
        ),
        migrations.RunSQL(
            sql="""
                CREATE TRIGGER invoice_validate_update
                BEFORE UPDATE ON invoices_invoice
                FOR EACH ROW
                BEGIN
                    DECLARE fiscal_workspace BIGINT;
                    DECLARE fiscal_version INT;
                    DECLARE fiscal_name VARCHAR(255);
                    DECLARE fiscal_identifier VARCHAR(100);
                    DECLARE fiscal_regime VARCHAR(100);
                    DECLARE fiscal_vat BOOLEAN;
                    DECLARE fiscal_vat_rate DECIMAL(5,2);
                    DECLARE fiscal_withholding DECIMAL(5,2);
                    DECLARE source_proposal BIGINT;
                    DECLARE expected_line_count INT;
                    DECLARE actual_line_count INT;
                    DECLARE invalid_line_count INT;
                    DECLARE active_payment_count INT;

                    IF NEW.workspace_id <> OLD.workspace_id OR NEW.client_id <> OLD.client_id
                       OR NEW.project_id <> OLD.project_id THEN
                        SIGNAL SQLSTATE '45000'
                            SET MESSAGE_TEXT = 'Invoice origin is immutable.';
                    END IF;
                    IF OLD.status = 'VOID'
                       OR (OLD.status = 'DRAFT' AND NEW.status NOT IN ('DRAFT', 'ISSUING'))
                       OR (OLD.status = 'ISSUING' AND NEW.status NOT IN ('ISSUING', 'ISSUED'))
                       OR (OLD.status = 'ISSUED' AND NEW.status NOT IN ('ISSUED', 'VOID')) THEN
                        SIGNAL SQLSTATE '45000'
                            SET MESSAGE_TEXT = 'Invoice transition is invalid.';
                    END IF;
                    IF OLD.status <> 'DRAFT' AND (
                        NOT (NEW.number <=> OLD.number)
                        OR NOT (NEW.fiscal_configuration_id <=> OLD.fiscal_configuration_id)
                        OR NOT (NEW.fiscal_version <=> OLD.fiscal_version)
                        OR NOT (NEW.fiscal_legal_name <=> OLD.fiscal_legal_name)
                        OR NOT (NEW.fiscal_tax_identifier <=> OLD.fiscal_tax_identifier)
                        OR NOT (NEW.fiscal_tax_regime <=> OLD.fiscal_tax_regime)
                        OR NOT (NEW.fiscal_applies_vat <=> OLD.fiscal_applies_vat)
                        OR NOT (NEW.fiscal_vat_rate <=> OLD.fiscal_vat_rate)
                        OR NOT (NEW.fiscal_withholding_rate <=> OLD.fiscal_withholding_rate)
                        OR NOT (NEW.issued_at <=> OLD.issued_at)
                    ) THEN
                        SIGNAL SQLSTATE '45000'
                            SET MESSAGE_TEXT = 'Issued invoice data is immutable.';
                    END IF;
                    IF NEW.status = 'DRAFT' AND (
                        NEW.number IS NOT NULL OR NEW.fiscal_configuration_id IS NOT NULL
                        OR NEW.fiscal_version IS NOT NULL OR NEW.fiscal_legal_name <> ''
                        OR NEW.fiscal_tax_identifier <> '' OR NEW.fiscal_tax_regime <> ''
                        OR NEW.fiscal_applies_vat IS NOT NULL OR NEW.fiscal_vat_rate IS NOT NULL
                        OR NEW.fiscal_withholding_rate IS NOT NULL OR NEW.issued_at IS NOT NULL
                        OR NEW.voided_at IS NOT NULL OR NEW.void_reason <> ''
                    ) THEN
                        SIGNAL SQLSTATE '45000'
                            SET MESSAGE_TEXT = 'Draft invoices cannot contain issued data.';
                    END IF;
                    IF NEW.status IN ('ISSUING', 'ISSUED', 'VOID') THEN
                        SELECT workspace_id, version, legal_name, tax_identifier, tax_regime,
                               applies_vat, vat_rate, withholding_rate
                        INTO fiscal_workspace, fiscal_version, fiscal_name, fiscal_identifier,
                             fiscal_regime, fiscal_vat, fiscal_vat_rate, fiscal_withholding
                        FROM fiscal_fiscalconfiguration
                        WHERE id = NEW.fiscal_configuration_id;

                        IF NEW.number IS NULL OR NEW.number NOT REGEXP '^INV-[0-9]{6}$'
                           OR NEW.issued_at IS NULL OR fiscal_workspace IS NULL
                           OR fiscal_workspace <> NEW.workspace_id
                           OR NOT (NEW.fiscal_version <=> fiscal_version)
                           OR NOT (NEW.fiscal_legal_name <=> fiscal_name)
                           OR NOT (NEW.fiscal_tax_identifier <=> fiscal_identifier)
                           OR NOT (NEW.fiscal_tax_regime <=> fiscal_regime)
                           OR NOT (NEW.fiscal_applies_vat <=> fiscal_vat)
                           OR NOT (NEW.fiscal_vat_rate <=> fiscal_vat_rate)
                           OR NOT (NEW.fiscal_withholding_rate <=> fiscal_withholding) THEN
                            SIGNAL SQLSTATE '45000'
                                SET MESSAGE_TEXT = 'Issued invoice fiscal snapshot is invalid.';
                        END IF;
                    END IF;
                    IF NEW.status = 'ISSUED' THEN
                        SELECT proposal_id INTO source_proposal
                        FROM projects_project
                        WHERE id = NEW.project_id;
                        SELECT COUNT(*) INTO expected_line_count
                        FROM proposals_proposallineitem
                        WHERE proposal_id = source_proposal;
                        SELECT COUNT(*) INTO actual_line_count
                        FROM invoices_invoicelineitem
                        WHERE invoice_id = NEW.id;
                        SELECT COUNT(*) INTO invalid_line_count
                        FROM invoices_invoicelineitem AS line_item
                        LEFT JOIN proposals_proposallineitem AS source_line
                            ON source_line.proposal_id = source_proposal
                           AND source_line.position = line_item.position
                        WHERE line_item.invoice_id = NEW.id
                          AND (
                              source_line.id IS NULL
                              OR NOT (source_line.service_name <=> line_item.service_name)
                              OR NOT (source_line.description <=> line_item.description)
                              OR NOT (source_line.unit_of_measure <=> line_item.unit_of_measure)
                              OR NOT (source_line.quantity <=> line_item.quantity)
                              OR NOT (source_line.unit_rate <=> line_item.unit_rate)
                              OR NOT (source_line.currency <=> line_item.currency)
                              OR NOT (line_item.vat_rate <=> IF(NEW.fiscal_applies_vat, NEW.fiscal_vat_rate, 0.00))
                              OR NOT (line_item.withholding_rate <=> NEW.fiscal_withholding_rate)
                          );
                        IF expected_line_count = 0 OR actual_line_count <> expected_line_count
                           OR invalid_line_count <> 0 THEN
                            SIGNAL SQLSTATE '45000'
                                SET MESSAGE_TEXT = 'Issued invoice line snapshots are invalid.';
                        END IF;
                    END IF;
                    IF OLD.status = 'ISSUED' AND NEW.status = 'VOID' THEN
                        SELECT COUNT(*) INTO active_payment_count
                        FROM payments_payment AS payment
                        WHERE payment.invoice_id = NEW.id
                          AND NOT EXISTS (
                              SELECT 1 FROM payments_paymentreversal AS reversal
                              WHERE reversal.payment_id = payment.id
                          );
                        IF active_payment_count > 0 THEN
                            SIGNAL SQLSTATE '45000'
                                SET MESSAGE_TEXT = 'Issued invoices with active payments cannot be voided.';
                        END IF;
                    END IF;
                    IF NEW.status = 'ISSUED'
                       AND (NEW.voided_at IS NOT NULL OR NEW.void_reason <> '') THEN
                        SIGNAL SQLSTATE '45000'
                            SET MESSAGE_TEXT = 'Issued invoices cannot contain void data.';
                    END IF;
                    IF NEW.status = 'VOID'
                       AND (NEW.voided_at IS NULL OR NEW.void_reason = '') THEN
                        SIGNAL SQLSTATE '45000'
                            SET MESSAGE_TEXT = 'Void invoices require a reason.';
                    END IF;
                END
            """,
            reverse_sql=None,
        ),
    ]
