from django.db import migrations, models


HARDENED_INSERT_TRIGGER = """
CREATE TRIGGER audit_event_validate_insert BEFORE INSERT ON audit_auditevent FOR EACH ROW BEGIN
IF NEW.target_membership_id <= 0 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Audit event target membership ID is invalid.'; END IF;
IF NOT EXISTS (SELECT 1 FROM workspaces_membership WHERE id = NEW.target_membership_id AND workspace_id = NEW.workspace_id) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Audit event target membership must belong to the workspace.'; END IF;
IF NOT EXISTS (SELECT 1 FROM workspaces_membership WHERE workspace_id = NEW.workspace_id AND user_id = NEW.actor_id) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Audit event actor must be a current workspace member.'; END IF;
IF (NEW.role_before IS NOT NULL AND NEW.role_before NOT IN ('OWNER','ADMINISTRATIVE','OPERATIONAL')) OR (NEW.role_after IS NOT NULL AND NEW.role_after NOT IN ('OWNER','ADMINISTRATIVE','OPERATIONAL')) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Audit event role snapshot is invalid.'; END IF;
IF NEW.event_type = 'workspace.created' THEN IF NEW.role_before IS NOT NULL OR NEW.role_after IS NULL OR NEW.role_after <> 'OWNER' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Workspace creation audit snapshot is invalid.'; END IF;
ELSEIF NEW.event_type = 'membership.role_changed' THEN IF NEW.role_before IS NULL OR NEW.role_after IS NULL OR NEW.role_before = NEW.role_after THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Membership role-change audit snapshot is invalid.'; END IF;
ELSEIF NEW.event_type = 'membership.removed' THEN IF NEW.role_before IS NULL OR NEW.role_after IS NOT NULL THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Membership removal audit snapshot is invalid.'; END IF;
ELSE SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Audit event type is invalid.'; END IF;
END
"""

LEGACY_INSERT_TRIGGER = """
CREATE TRIGGER audit_event_validate_insert BEFORE INSERT ON audit_auditevent FOR EACH ROW BEGIN
IF NEW.target_membership_id <= 0 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Audit event target membership ID is invalid.'; END IF;
IF NOT EXISTS (SELECT 1 FROM workspaces_membership WHERE id = NEW.target_membership_id AND workspace_id = NEW.workspace_id) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Audit event target membership must belong to the workspace.'; END IF;
IF NOT EXISTS (SELECT 1 FROM workspaces_membership WHERE workspace_id = NEW.workspace_id AND user_id = NEW.actor_id) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Audit event actor must be a current workspace member.'; END IF;
IF (NEW.role_before IS NOT NULL AND NEW.role_before NOT IN ('OWNER','ADMINISTRATIVE','OPERATIONAL')) OR (NEW.role_after IS NOT NULL AND NEW.role_after NOT IN ('OWNER','ADMINISTRATIVE','OPERATIONAL')) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Audit event role snapshot is invalid.'; END IF;
IF NEW.event_type = 'workspace.created' THEN IF NEW.role_before IS NOT NULL OR NEW.role_after <> 'OWNER' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Workspace creation audit snapshot is invalid.'; END IF;
ELSEIF NEW.event_type = 'membership.role_changed' THEN IF NEW.role_before IS NULL OR NEW.role_after IS NULL OR NEW.role_before = NEW.role_after THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Membership role-change audit snapshot is invalid.'; END IF;
ELSEIF NEW.event_type = 'membership.removed' THEN IF NEW.role_before IS NULL OR NEW.role_after IS NOT NULL THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Membership removal audit snapshot is invalid.'; END IF;
ELSE SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Audit event type is invalid.'; END IF;
END
"""


class Migration(migrations.Migration):
    dependencies = [("audit", "0001_initial")]

    operations = [
        migrations.AlterModelOptions(
            name="auditevent",
            options={"base_manager_name": "_base_objects", "ordering": ["-created_at", "-pk"]},
        ),
        migrations.AlterModelManagers(
            name="auditevent",
            managers=[
                ("_base_objects", models.Manager()),
            ],
        ),
        migrations.RunSQL(
            sql=["DROP TRIGGER IF EXISTS audit_event_validate_insert", HARDENED_INSERT_TRIGGER],
            reverse_sql=[
                "DROP TRIGGER IF EXISTS audit_event_validate_insert",
                LEGACY_INSERT_TRIGGER,
            ],
        ),
    ]
