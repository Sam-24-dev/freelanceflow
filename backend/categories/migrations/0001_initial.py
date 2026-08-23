import django.db.models.deletion
import uuid
from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True
    dependencies = [("workspaces", "0002_alter_membership_user")]
    operations = [
        migrations.CreateModel(name="Category", fields=[
            ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
            ("public_id", models.UUIDField(default=uuid.uuid4, editable=False, unique=True)),
            ("name", models.CharField(max_length=255)),
            ("name_normalized", models.CharField(editable=False, max_length=255)),
            ("description", models.TextField(blank=True)),
            ("default_deductible", models.BooleanField(default=False)),
            ("monthly_budget", models.DecimalField(blank=True, decimal_places=2, max_digits=18, null=True, validators=[MinValueValidator(Decimal("0.00"))])),
            ("status", models.CharField(choices=[("ACTIVE", "Active"), ("INACTIVE", "Inactive")], default="ACTIVE", max_length=10)),
            ("created_at", models.DateTimeField(auto_now_add=True)),
            ("updated_at", models.DateTimeField(auto_now=True)),
            ("workspace", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="categories", to="workspaces.workspace")),
        ], options={"ordering": ["name", "id"], "base_manager_name": "objects"}),
        migrations.AddConstraint(model_name="category", constraint=models.UniqueConstraint(fields=("workspace", "name_normalized"), name="category_workspace_normalized_name_unique")),
        migrations.AddConstraint(model_name="category", constraint=models.CheckConstraint(condition=models.Q(("monthly_budget__isnull", True), ("monthly_budget__gte", Decimal("0.00")), _connector="OR"), name="category_monthly_budget_nonnegative")),
        migrations.AddConstraint(model_name="category", constraint=models.CheckConstraint(condition=models.Q(("status__in", ["ACTIVE", "INACTIVE"])), name="category_status_allowed")),
        migrations.AddConstraint(model_name="category", constraint=models.CheckConstraint(condition=models.Q(("default_deductible__in", [True, False])), name="category_default_deductible_boolean")),
        migrations.AddConstraint(model_name="category", constraint=models.CheckConstraint(condition=models.Q(("name__gt", "")), name="category_name_nonempty")),
        migrations.AddConstraint(model_name="category", constraint=models.CheckConstraint(condition=models.Q(("name_normalized__gt", "")), name="category_name_normalized_nonempty")),
        migrations.RunSQL(sql="""CREATE TRIGGER category_normalize_validate_insert BEFORE INSERT ON categories_category FOR EACH ROW BEGIN SET NEW.name = REGEXP_REPLACE(TRIM(NEW.name), '[[:space:]]+', ' '); SET NEW.name_normalized = LOWER(NEW.name); SET NEW.description = REGEXP_REPLACE(TRIM(NEW.description), '[[:space:]]+', ' '); IF NEW.name = '' OR NEW.name_normalized = '' OR NEW.default_deductible NOT IN (0, 1) OR (NEW.monthly_budget IS NOT NULL AND NEW.monthly_budget < 0) OR NEW.status NOT IN ('ACTIVE', 'INACTIVE') THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Category values are invalid.'; END IF; END""", reverse_sql=None),
        migrations.RunSQL(sql="""CREATE TRIGGER category_normalize_validate_update BEFORE UPDATE ON categories_category FOR EACH ROW BEGIN IF NEW.workspace_id <> OLD.workspace_id OR NEW.public_id <> OLD.public_id THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Category tenant and public identity are immutable.'; END IF; SET NEW.name = REGEXP_REPLACE(TRIM(NEW.name), '[[:space:]]+', ' '); SET NEW.name_normalized = LOWER(NEW.name); SET NEW.description = REGEXP_REPLACE(TRIM(NEW.description), '[[:space:]]+', ' '); IF NEW.name = '' OR NEW.name_normalized = '' OR NEW.default_deductible NOT IN (0, 1) OR (NEW.monthly_budget IS NOT NULL AND NEW.monthly_budget < 0) OR NEW.status NOT IN ('ACTIVE', 'INACTIVE') THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Category values are invalid.'; END IF; END""", reverse_sql=None),
        migrations.RunSQL(sql="""CREATE TRIGGER category_no_delete BEFORE DELETE ON categories_category FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Categories cannot be deleted.'; END""", reverse_sql=None),
    ]
