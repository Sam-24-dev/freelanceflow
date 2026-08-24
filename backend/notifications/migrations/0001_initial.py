import django.db.models.deletion
import uuid

from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("payments", "0002_enforce_trimmed_text_contract"),
        ("workspaces", "0002_alter_membership_user"),
    ]

    operations = [
        migrations.CreateModel(
            name="InAppNotification",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("public_id", models.UUIDField(default=uuid.uuid4, editable=False, unique=True)),
                ("kind", models.CharField(choices=[("payment.recorded", "Payment recorded")], default="payment.recorded", max_length=32)),
                ("state", models.CharField(choices=[("UNREAD", "Unread"), ("READ", "Read"), ("ARCHIVED", "Archived")], default="UNREAD", max_length=10)),
                ("read_at", models.DateTimeField(blank=True, null=True)),
                ("archived_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("recipient", models.ForeignKey(db_constraint=False, on_delete=django.db.models.deletion.DO_NOTHING, related_name="notifications", to="workspaces.membership")),
                ("source_payment", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="notifications", to="payments.payment")),
                ("workspace", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="notifications", to="workspaces.workspace")),
            ],
            options={"base_manager_name": "objects"},
        ),
        migrations.AddConstraint(model_name="inappnotification", constraint=models.UniqueConstraint(fields=("source_payment", "recipient"), name="notification_source_payment_recipient_unique")),
        migrations.AddConstraint(model_name="inappnotification", constraint=models.CheckConstraint(condition=models.Q(("state__in", ["UNREAD", "READ", "ARCHIVED"])), name="notification_supported_state")),
        migrations.AddConstraint(model_name="inappnotification", constraint=models.CheckConstraint(condition=models.Q(("archived_at__isnull", True), ("read_at__isnull", True), ("state", "UNREAD")) | models.Q(("archived_at__isnull", True), ("read_at__isnull", False), ("state", "READ")) | models.Q(("archived_at__isnull", False), ("read_at__isnull", False), ("state", "ARCHIVED")), name="notification_timestamp_shape")),
        migrations.AddConstraint(model_name="inappnotification", constraint=models.CheckConstraint(condition=models.Q(("kind", "payment.recorded")), name="notification_kind_fixed")),
        migrations.AddIndex(model_name="inappnotification", index=models.Index(fields=["recipient", "state", "created_at"], name="notif_recipient_state_created")),
        # Django must not collect this child: InnoDB owns the recipient deletion cascade.
        migrations.RunSQL(sql="""ALTER TABLE notifications_inappnotification ADD CONSTRAINT notification_recipient_membership_fk FOREIGN KEY (recipient_id) REFERENCES workspaces_membership (id) ON DELETE CASCADE""", reverse_sql="""ALTER TABLE notifications_inappnotification DROP FOREIGN KEY notification_recipient_membership_fk"""),
        migrations.RunSQL(sql="""
            CREATE TRIGGER notification_validate_insert
            BEFORE INSERT ON notifications_inappnotification
            FOR EACH ROW
            BEGIN
                DECLARE recipient_workspace BIGINT DEFAULT NULL;
                DECLARE payment_workspace BIGINT DEFAULT NULL;
                SELECT workspace_id INTO recipient_workspace FROM workspaces_membership WHERE id = NEW.recipient_id;
                SELECT workspace_id INTO payment_workspace FROM payments_payment WHERE id = NEW.source_payment_id;
                IF recipient_workspace IS NULL OR payment_workspace IS NULL
                   OR NEW.workspace_id <> recipient_workspace OR NEW.workspace_id <> payment_workspace
                   OR NEW.kind <> 'payment.recorded' OR NEW.state <> 'UNREAD'
                   OR NEW.read_at IS NOT NULL OR NEW.archived_at IS NOT NULL THEN
                    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Notification insert is invalid.';
                END IF;
            END
        """, reverse_sql=None),
        migrations.RunSQL(sql="""
            CREATE TRIGGER notification_validate_update
            BEFORE UPDATE ON notifications_inappnotification
            FOR EACH ROW
            BEGIN
                IF NOT (OLD.workspace_id <=> NEW.workspace_id)
                   OR NOT (OLD.recipient_id <=> NEW.recipient_id)
                   OR NOT (OLD.source_payment_id <=> NEW.source_payment_id)
                   OR NOT (OLD.public_id <=> NEW.public_id) OR NOT (OLD.kind <=> NEW.kind) OR NOT (OLD.created_at <=> NEW.created_at) THEN
                    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Notification identity is immutable.';
                END IF;
                IF NOT ((OLD.state = 'UNREAD' AND NEW.state = 'READ' AND OLD.read_at IS NULL
                    AND OLD.archived_at IS NULL AND NEW.read_at IS NOT NULL AND NEW.archived_at IS NULL)
                    OR (OLD.state = 'READ' AND NEW.state = 'ARCHIVED' AND OLD.read_at IS NOT NULL
                    AND OLD.archived_at IS NULL AND NEW.read_at <=> OLD.read_at AND NEW.archived_at IS NOT NULL)) THEN
                    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Notification lifecycle transition is invalid.';
                END IF;
            END
        """, reverse_sql=None),
        # InnoDB FK cascades do not fire child DELETE triggers; direct SQL deletes remain rejected.
        migrations.RunSQL(sql="""CREATE TRIGGER notification_no_delete BEFORE DELETE ON notifications_inappnotification FOR EACH ROW BEGIN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Notifications cannot be deleted directly.'; END""", reverse_sql=None),
    ]
