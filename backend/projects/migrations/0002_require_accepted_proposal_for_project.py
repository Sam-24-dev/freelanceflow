from django.db import migrations


class Migration(migrations.Migration):
    """Forward-only replacement for the Project insert trigger."""

    dependencies = [
        ("projects", "0001_initial"),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
                DROP TRIGGER IF EXISTS project_source_matches_proposal_on_insert;
                CREATE TRIGGER project_source_matches_proposal_on_insert
                BEFORE INSERT ON projects_project
                FOR EACH ROW
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM proposals_proposal
                        WHERE id = NEW.proposal_id
                          AND status = 'ACCEPTED'
                          AND workspace_id = NEW.workspace_id
                          AND client_id = NEW.client_id
                    ) THEN
                        SIGNAL SQLSTATE '45000'
                            SET MESSAGE_TEXT = 'Project source must be an accepted proposal with matching workspace and client.';
                    END IF;
                END
            """,
            reverse_sql=None,
        ),
    ]
