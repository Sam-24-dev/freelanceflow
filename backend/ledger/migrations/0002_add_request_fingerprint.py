from django.db import migrations, models


def ensure_ledger_table_is_empty(apps, schema_editor):
    LedgerEntry = apps.get_model("ledger", "LedgerEntry")
    if LedgerEntry.objects.exists():
        raise RuntimeError(
            "Cannot add request_fingerprint to a non-empty ledger table. "
            "Backfill legacy rows through an audited, append-only migration first."
        )


class Migration(migrations.Migration):
    dependencies = [("ledger", "0001_initial")]

    operations = [
        migrations.RunPython(ensure_ledger_table_is_empty, migrations.RunPython.noop),
        migrations.AddField(
            model_name="ledgerentry",
            name="request_fingerprint",
            field=models.CharField(editable=False, max_length=64, null=True),
        ),
        migrations.RunSQL(
            sql="DROP TRIGGER IF EXISTS ledger_validate_insert",
            reverse_sql=None,
        ),
        migrations.RunSQL(
            sql="""
                CREATE TRIGGER ledger_validate_insert BEFORE INSERT ON ledger_ledgerentry FOR EACH ROW
                BEGIN
                    DECLARE category_workspace, client_workspace, project_workspace, project_client BIGINT;
                    DECLARE category_name VARCHAR(255); DECLARE category_deductible BOOLEAN; DECLARE category_status VARCHAR(10);
                    DECLARE original_id, original_workspace, original_category, original_client, original_project BIGINT;
                    DECLARE original_direction VARCHAR(7); DECLARE original_source VARCHAR(8); DECLARE original_amount DECIMAL(18,2);
                    DECLARE original_name VARCHAR(255); DECLARE original_deductible BOOLEAN;
                    SET NEW.description = REGEXP_REPLACE(TRIM(NEW.description), '[[:space:]]+', ' ');
                    IF NEW.public_id NOT REGEXP '^[0-9a-f]{32}$' OR NEW.idempotency_key NOT REGEXP '^[0-9a-f]{32}$'
                       OR NEW.amount <= 0 OR NEW.currency <> 'USD' OR CHAR_LENGTH(NEW.description) = 0
                       OR NEW.direction NOT IN ('INCOME', 'EXPENSE') OR NEW.source NOT IN ('MANUAL', 'REVERSAL') THEN
                        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Ledger scalar values are invalid.';
                    END IF;
                    IF NEW.client_id IS NOT NULL THEN
                        SELECT workspace_id INTO client_workspace FROM clients_client WHERE id = NEW.client_id;
                        IF client_workspace <> NEW.workspace_id THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Ledger client tenant mismatch.'; END IF;
                    END IF;
                    IF NEW.project_id IS NOT NULL THEN
                        SELECT workspace_id, client_id INTO project_workspace, project_client FROM projects_project WHERE id = NEW.project_id;
                        IF project_workspace <> NEW.workspace_id OR NEW.client_id IS NULL OR project_client <> NEW.client_id THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Ledger project tenant mismatch.'; END IF;
                    END IF;
                    IF NEW.category_id IS NOT NULL THEN
                        SELECT workspace_id, name, default_deductible, status INTO category_workspace, category_name, category_deductible, category_status FROM categories_category WHERE id = NEW.category_id;
                        IF category_workspace <> NEW.workspace_id THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Ledger category tenant mismatch.'; END IF;
                    END IF;
                    IF NEW.source = 'MANUAL' AND ((NEW.direction = 'EXPENSE' AND (NEW.category_id IS NULL OR category_status <> 'ACTIVE' OR NOT (NEW.category_name_snapshot <=> category_name) OR NOT (NEW.category_deductible_snapshot <=> category_deductible))) OR (NEW.direction = 'INCOME' AND (NEW.category_id IS NOT NULL OR NEW.category_name_snapshot <> '' OR NEW.category_deductible_snapshot IS NOT NULL)) OR NEW.reversal_of_id IS NOT NULL) THEN
                        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Ledger manual category facts are invalid.';
                    END IF;
                    IF NEW.source = 'REVERSAL' THEN
                        SELECT id, workspace_id, source, direction, amount, category_id, category_name_snapshot, category_deductible_snapshot, client_id, project_id INTO original_id, original_workspace, original_source, original_direction, original_amount, original_category, original_name, original_deductible, original_client, original_project FROM ledger_ledgerentry WHERE id = NEW.reversal_of_id;
                        IF original_id IS NULL OR original_workspace <> NEW.workspace_id OR original_source <> 'MANUAL' OR original_direction = NEW.direction OR original_amount <> NEW.amount OR NOT (NEW.category_id <=> original_category) OR NOT (NEW.category_name_snapshot <=> original_name) OR NOT (NEW.category_deductible_snapshot <=> original_deductible) OR NOT (NEW.client_id <=> original_client) OR NOT (NEW.project_id <=> original_project) THEN
                            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Ledger reversal is invalid.';
                        END IF;
                    END IF;
                    SET NEW.fingerprint = SHA2(CONCAT_WS('|', NEW.workspace_id, NEW.public_id, NEW.idempotency_key, NEW.direction, NEW.source, NEW.amount, NEW.currency, NEW.occurred_on, NEW.description, COALESCE(NEW.category_id, 'NULL'), NEW.category_name_snapshot, COALESCE(NEW.category_deductible_snapshot, 'NULL'), COALESCE(NEW.client_id, 'NULL'), COALESCE(NEW.project_id, 'NULL'), COALESCE(NEW.reversal_of_id, 'NULL'), NEW.created_by_id), 256);
                    SET NEW.request_fingerprint = SHA2(CONCAT_WS('|', NEW.workspace_id, NEW.direction, NEW.source, CAST(NEW.amount AS CHAR), NEW.currency, DATE_FORMAT(NEW.occurred_on, '%Y-%m-%d'), NEW.description, COALESCE(CAST(NEW.category_id AS CHAR), 'NULL'), COALESCE(CAST(NEW.client_id AS CHAR), 'NULL'), COALESCE(CAST(NEW.project_id AS CHAR), 'NULL'), COALESCE(CAST(NEW.reversal_of_id AS CHAR), 'NULL')), 256);
                END
            """,
            reverse_sql=None,
        ),
        migrations.AlterField(
            model_name="ledgerentry",
            name="request_fingerprint",
            field=models.CharField(editable=False, max_length=64),
        ),
    ]
