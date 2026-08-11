from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("fiscal", "0001_initial"),
    ]

    operations = [
        migrations.RunSQL(
            sql="DROP TRIGGER IF EXISTS fiscal_configuration_validate_insert",
            reverse_sql=None,
        ),
        migrations.RunSQL(
            sql="""
                CREATE TRIGGER fiscal_configuration_validate_insert
                BEFORE INSERT ON fiscal_fiscalconfiguration
                FOR EACH ROW
                BEGIN
                    DECLARE expected_version INT;

                    SELECT COALESCE(MAX(version), 0) + 1
                    INTO expected_version
                    FROM fiscal_fiscalconfiguration
                    WHERE workspace_id = NEW.workspace_id;

                    IF NEW.version <> expected_version
                       OR NEW.vat_rate < 0 OR NEW.vat_rate > 100
                       OR NEW.withholding_rate < 0 OR NEW.withholding_rate > 100
                       OR (NEW.applies_vat = 0 AND NEW.vat_rate <> 0)
                       OR (NEW.applies_vat = 1 AND NEW.vat_rate <= 0) THEN
                        SIGNAL SQLSTATE '45000'
                            SET MESSAGE_TEXT = 'Fiscal configuration values are invalid.';
                    END IF;
                END
            """,
            reverse_sql=None,
        ),
    ]
