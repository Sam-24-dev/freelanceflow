import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models
from django.db.models import F, Q

INSERT_TRIGGER = """
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
IMMUTABLE_UPDATE = "CREATE TRIGGER audit_event_immutable_update BEFORE UPDATE ON audit_auditevent FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Audit events are immutable.'; END"
IMMUTABLE_DELETE = "CREATE TRIGGER audit_event_immutable_delete BEFORE DELETE ON audit_auditevent FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Audit events are immutable.'; END"

class Migration(migrations.Migration):
    initial = True
    dependencies = [migrations.swappable_dependency(settings.AUTH_USER_MODEL), ("workspaces", "0002_alter_membership_user")]
    operations = [
        migrations.CreateModel(name="AuditEvent", fields=[
            ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
            ("event_type", models.CharField(choices=[("workspace.created","Workspace created"),("membership.role_changed","Membership role changed"),("membership.removed","Membership removed")], max_length=32)),
            ("target_membership_id", models.PositiveBigIntegerField()),
            ("role_before", models.CharField(blank=True, choices=[("OWNER","Owner"),("ADMINISTRATIVE","Administrative"),("OPERATIONAL","Operational")], max_length=20, null=True)),
            ("role_after", models.CharField(blank=True, choices=[("OWNER","Owner"),("ADMINISTRATIVE","Administrative"),("OPERATIONAL","Operational")], max_length=20, null=True)),
            ("created_at", models.DateTimeField(auto_now_add=True)),
            ("actor", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="audit_events", to=settings.AUTH_USER_MODEL)),
            ("workspace", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="audit_events", to="workspaces.workspace")),
        ], options={"base_manager_name":"objects", "ordering":["-created_at","-pk"], "constraints":[
            models.CheckConstraint(condition=Q(("target_membership_id__gt", 0)), name="audit_event_target_membership_positive"),
            models.CheckConstraint(condition=(Q(("event_type","workspace.created"),("role_after","OWNER"),("role_before__isnull",True)) | Q(("event_type","membership.role_changed"),("role_after__isnull",False),("role_before__isnull",False)) | Q(("event_type","membership.removed"),("role_after__isnull",True),("role_before__isnull",False))), name="audit_event_snapshot_shape_valid"),
            models.CheckConstraint(condition=(~Q(("event_type","membership.role_changed")) | ~Q(("role_before", F("role_after")))), name="audit_event_role_change_has_difference"),
        ]}),
        migrations.RunSQL(INSERT_TRIGGER, "DROP TRIGGER IF EXISTS audit_event_validate_insert"),
        migrations.RunSQL(IMMUTABLE_UPDATE, "DROP TRIGGER IF EXISTS audit_event_immutable_update"),
        migrations.RunSQL(IMMUTABLE_DELETE, "DROP TRIGGER IF EXISTS audit_event_immutable_delete"),
    ]