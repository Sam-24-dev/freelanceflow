import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [("workspaces", "0002_alter_membership_user")]

    operations = [
        migrations.CreateModel(
            name="MembershipInterfacePreference",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("sidebar_collapsed", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("owner", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="interface_preferences", to="workspaces.membership")),
            ],
            options={"base_manager_name": "objects"},
        ),
        migrations.AddConstraint(
            model_name="membershipinterfacepreference",
            constraint=models.CheckConstraint(condition=models.Q(("sidebar_collapsed__in", [True, False])), name="membership_interface_preference_sidebar_collapsed_boolean"),
        ),
    ]
