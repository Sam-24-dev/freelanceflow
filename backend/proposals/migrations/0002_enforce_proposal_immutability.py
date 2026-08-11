from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("proposals", "0001_initial"),
    ]

    operations = [
        migrations.AlterModelOptions(
            name="proposal",
            options={"base_manager_name": "objects"},
        ),
        migrations.AlterModelOptions(
            name="proposallineitem",
            options={"base_manager_name": "objects"},
        ),
        migrations.RunSQL(
            sql="""
                CREATE TRIGGER proposal_no_commercial_update_after_sent
                BEFORE UPDATE ON proposals_proposal
                FOR EACH ROW
                BEGIN
                    IF OLD.status <> 'DRAFT' AND (
                        NOT (NEW.workspace_id <=> OLD.workspace_id)
                        OR NOT (NEW.client_id <=> OLD.client_id)
                        OR NOT (NEW.title <=> OLD.title)
                        OR NOT (NEW.notes <=> OLD.notes)
                        OR NOT (NEW.issued_on <=> OLD.issued_on)
                        OR NOT (NEW.valid_until <=> OLD.valid_until)
                    ) THEN
                        SIGNAL SQLSTATE '45000'
                            SET MESSAGE_TEXT = 'Proposal commercial data is immutable after sending.';
                    END IF;
                END
            """,
            reverse_sql="DROP TRIGGER IF EXISTS proposal_no_commercial_update_after_sent",
        ),
        migrations.RunSQL(
            sql="""
                CREATE TRIGGER proposal_no_delete_after_sent
                BEFORE DELETE ON proposals_proposal
                FOR EACH ROW
                BEGIN
                    IF OLD.status <> 'DRAFT' THEN
                        SIGNAL SQLSTATE '45000'
                            SET MESSAGE_TEXT = 'Sent proposals cannot be deleted.';
                    END IF;
                END
            """,
            reverse_sql="DROP TRIGGER IF EXISTS proposal_no_delete_after_sent",
        ),
        migrations.RunSQL(
            sql="""
                CREATE TRIGGER proposal_line_no_insert_after_sent
                BEFORE INSERT ON proposals_proposallineitem
                FOR EACH ROW
                BEGIN
                    IF EXISTS (
                        SELECT 1 FROM proposals_proposal
                        WHERE id = NEW.proposal_id AND status <> 'DRAFT'
                    ) THEN
                        SIGNAL SQLSTATE '45000'
                            SET MESSAGE_TEXT = 'Proposal lines are immutable after sending.';
                    END IF;
                END
            """,
            reverse_sql="DROP TRIGGER IF EXISTS proposal_line_no_insert_after_sent",
        ),
        migrations.RunSQL(
            sql="""
                CREATE TRIGGER proposal_line_no_update_after_sent
                BEFORE UPDATE ON proposals_proposallineitem
                FOR EACH ROW
                BEGIN
                    IF EXISTS (
                        SELECT 1 FROM proposals_proposal
                        WHERE id IN (OLD.proposal_id, NEW.proposal_id) AND status <> 'DRAFT'
                    ) THEN
                        SIGNAL SQLSTATE '45000'
                            SET MESSAGE_TEXT = 'Proposal lines are immutable after sending.';
                    END IF;
                END
            """,
            reverse_sql="DROP TRIGGER IF EXISTS proposal_line_no_update_after_sent",
        ),
        migrations.RunSQL(
            sql="""
                CREATE TRIGGER proposal_line_no_delete_after_sent
                BEFORE DELETE ON proposals_proposallineitem
                FOR EACH ROW
                BEGIN
                    IF EXISTS (
                        SELECT 1 FROM proposals_proposal
                        WHERE id = OLD.proposal_id AND status <> 'DRAFT'
                    ) THEN
                        SIGNAL SQLSTATE '45000'
                            SET MESSAGE_TEXT = 'Proposal lines are immutable after sending.';
                    END IF;
                END
            """,
            reverse_sql="DROP TRIGGER IF EXISTS proposal_line_no_delete_after_sent",
        ),
    ]
