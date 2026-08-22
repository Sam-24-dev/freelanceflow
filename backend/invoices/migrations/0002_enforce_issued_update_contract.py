from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("invoices", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="invoice",
            name="status",
            field=models.CharField(
                choices=[
                    ("DRAFT", "Draft"),
                    ("ISSUING", "Issuing"),
                    ("ISSUED", "Issued"),
                    ("VOID", "Void"),
                ],
                default="DRAFT",
                max_length=10,
            ),
        ),
        migrations.AlterModelOptions(
            name="invoice",
            options={"base_manager_name": "internal_objects"},
        ),
        migrations.AlterModelManagers(
            name="invoice",
            managers=[
                ("objects", models.Manager()),
                ("internal_objects", models.Manager()),
            ],
        ),
        migrations.RunSQL(
            sql="DROP TRIGGER IF EXISTS invoice_validate_insert",
            reverse_sql=None,
        ),
        migrations.RunSQL(
            sql="""
                CREATE TRIGGER invoice_validate_insert
                BEFORE INSERT ON invoices_invoice
                FOR EACH ROW
                BEGIN
                    DECLARE project_workspace BIGINT;
                    DECLARE project_client BIGINT;

                    SELECT workspace_id, client_id
                    INTO project_workspace, project_client
                    FROM projects_project
                    WHERE id = NEW.project_id;

                    IF project_workspace IS NULL OR NEW.workspace_id <> project_workspace
                       OR NEW.client_id <> project_client THEN
                        SIGNAL SQLSTATE '45000'
                            SET MESSAGE_TEXT = 'Invoice source must match its project.';
                    END IF;
                    IF NEW.status <> 'DRAFT' THEN
                        SIGNAL SQLSTATE '45000'
                            SET MESSAGE_TEXT = 'Invoices must be created as drafts.';
                    END IF;
                    IF NEW.number IS NOT NULL OR NEW.fiscal_configuration_id IS NOT NULL
                       OR NEW.fiscal_version IS NOT NULL OR NEW.fiscal_legal_name <> ''
                       OR NEW.fiscal_tax_identifier <> '' OR NEW.fiscal_tax_regime <> ''
                       OR NEW.fiscal_applies_vat IS NOT NULL OR NEW.fiscal_vat_rate IS NOT NULL
                       OR NEW.fiscal_withholding_rate IS NOT NULL OR NEW.issued_at IS NOT NULL
                       OR NEW.voided_at IS NOT NULL OR NEW.void_reason <> '' THEN
                        SIGNAL SQLSTATE '45000'
                            SET MESSAGE_TEXT = 'Draft invoices cannot contain issued data.';
                    END IF;
                END
            """,
            reverse_sql=None,
        ),
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
        migrations.RunSQL(
            sql="DROP TRIGGER IF EXISTS invoice_line_validate_insert",
            reverse_sql=None,
        ),
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
                END
            """,
            reverse_sql=None,
        ),
    ]
