import uuid
from decimal import Decimal

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("workspaces", "0002_alter_membership_user"),
        ("categories", "0001_initial"),
        ("clients", "0001_initial"),
        ("projects", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(name="LedgerEntry", fields=[
            ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
            ("public_id", models.UUIDField(default=uuid.uuid4, editable=False, unique=True)),
            ("idempotency_key", models.UUIDField()), ("fingerprint", models.CharField(editable=False, max_length=64)),
            ("direction", models.CharField(choices=[("INCOME", "Income"), ("EXPENSE", "Expense")], max_length=7)),
            ("source", models.CharField(choices=[("MANUAL", "Manual"), ("REVERSAL", "Reversal")], default="MANUAL", max_length=8)),
            ("amount", models.DecimalField(decimal_places=2, max_digits=18)), ("currency", models.CharField(default="USD", max_length=3)),
            ("occurred_on", models.DateField()), ("description", models.CharField(max_length=500)),
            ("category_name_snapshot", models.CharField(blank=True, max_length=255)),
            ("category_deductible_snapshot", models.BooleanField(blank=True, null=True)),
            ("created_at", models.DateTimeField(auto_now_add=True)),
            ("category", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="ledger_entries", to="categories.category")),
            ("client", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="ledger_entries", to="clients.client")),
            ("project", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="ledger_entries", to="projects.project")),
            ("reversal_of", models.OneToOneField(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="reversal", to="ledger.ledgerentry")),
            ("created_by", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="ledger_entries", to=settings.AUTH_USER_MODEL)),
            ("workspace", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="ledger_entries", to="workspaces.workspace")),
        ], options={"base_manager_name": "objects"}),
        migrations.AddConstraint(model_name="ledgerentry", constraint=models.UniqueConstraint(fields=("workspace", "idempotency_key"), name="ledger_workspace_idempotency_unique")),
        migrations.AddConstraint(model_name="ledgerentry", constraint=models.CheckConstraint(condition=models.Q(("direction__in", ["INCOME", "EXPENSE"])), name="ledger_direction_allowed")),
        migrations.AddConstraint(model_name="ledgerentry", constraint=models.CheckConstraint(condition=models.Q(("source__in", ["MANUAL", "REVERSAL"])), name="ledger_source_allowed")),
        migrations.AddConstraint(model_name="ledgerentry", constraint=models.CheckConstraint(condition=models.Q(("amount__gt", Decimal("0.00"))), name="ledger_amount_positive")),
        migrations.AddConstraint(model_name="ledgerentry", constraint=models.CheckConstraint(condition=models.Q(("currency", "USD")), name="ledger_currency_usd")),
        migrations.AddConstraint(model_name="ledgerentry", constraint=models.CheckConstraint(condition=models.Q(("description__gt", "")), name="ledger_description_nonempty")),
        migrations.AddConstraint(model_name="ledgerentry", constraint=models.CheckConstraint(condition=models.Q(source="REVERSAL") | models.Q(source="MANUAL", reversal_of__isnull=True), name="ledger_reversal_source_consistent")),
        migrations.AddConstraint(model_name="ledgerentry", constraint=models.CheckConstraint(condition=models.Q(source="REVERSAL", reversal_of__isnull=False) | models.Q(source="MANUAL"), name="ledger_reversal_reference_consistent")),
        migrations.AddConstraint(model_name="ledgerentry", constraint=models.CheckConstraint(condition=models.Q(source="REVERSAL") | models.Q(source="MANUAL", direction="EXPENSE", category__isnull=False, category_name_snapshot__gt="", category_deductible_snapshot__isnull=False) | models.Q(source="MANUAL", direction="INCOME", category__isnull=True, category_name_snapshot="", category_deductible_snapshot__isnull=True), name="ledger_manual_category_consistent")),
        migrations.RunSQL(sql="""
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
            END
        """, reverse_sql=None),
        migrations.RunSQL(sql="""CREATE TRIGGER ledger_no_update BEFORE UPDATE ON ledger_ledgerentry FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Ledger entries are immutable.'; END""", reverse_sql=None),
        migrations.RunSQL(sql="""CREATE TRIGGER ledger_no_delete BEFORE DELETE ON ledger_ledgerentry FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Ledger entries cannot be deleted.'; END""", reverse_sql=None),
    ]
