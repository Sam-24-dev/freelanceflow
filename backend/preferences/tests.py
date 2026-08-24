from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

from django.db import DatabaseError, close_old_connections, connection, transaction
from django.test import TestCase, TransactionTestCase

from accounts.models import User
from preferences.models import (
    InterfacePreferenceWriteBoundaryViolation,
    MembershipInterfacePreference,
)
from preferences.services import (
    InterfacePreferenceAccessDenied,
    get_interface_preferences,
    update_interface_preferences,
)
from workspaces.context import ActiveWorkspaceContext
from workspaces.models import Membership
from workspaces.services import LastOwnerViolation, create_workspace_with_owner, remove_membership


class InterfacePreferenceServiceTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(email="preferences-owner@example.com", password="password")
        self.workspace = create_workspace_with_owner(owner=self.owner, name="Preferences", slug="preferences")
        self.owner_membership = Membership.objects.get(workspace=self.workspace, user=self.owner)
        self.context = ActiveWorkspaceContext(self.workspace, self.owner_membership)

    def member_context(self, role, email):
        user = User.objects.create_user(email=email, password="password")
        membership = Membership.objects.create(workspace=self.workspace, user=user, role=role)
        return user, ActiveWorkspaceContext(self.workspace, membership)

    def test_get_lazily_materializes_one_default_profile(self):
        self.assertFalse(MembershipInterfacePreference.objects.exists())
        first = get_interface_preferences(self.context)
        second = get_interface_preferences(self.context)
        self.assertFalse(first.sidebar_collapsed)
        self.assertEqual(first.pk, second.pk)
        self.assertEqual(MembershipInterfacePreference.objects.count(), 1)

    def test_update_requires_a_strict_bool_without_materializing(self):
        for value in (0, 1, "true", None):
            with self.subTest(value=value):
                with self.assertRaises(TypeError):
                    update_interface_preferences(self.context, value)
        self.assertFalse(MembershipInterfacePreference.objects.exists())
        self.assertTrue(update_interface_preferences(self.context, True).sidebar_collapsed)

    def test_same_user_has_independent_preferences_per_workspace_membership(self):
        other = create_workspace_with_owner(owner=self.owner, name="Other Preferences", slug="other-preferences")
        other_context = ActiveWorkspaceContext(other, Membership.objects.get(workspace=other, user=self.owner))
        update_interface_preferences(self.context, True)
        self.assertFalse(get_interface_preferences(other_context).sidebar_collapsed)
        self.assertEqual(MembershipInterfacePreference.objects.count(), 2)

    def test_every_membership_role_can_manage_its_own_preferences(self):
        contexts = [self.context]
        for role in (Membership.Role.ADMINISTRATIVE, Membership.Role.OPERATIONAL):
            _, context = self.member_context(role, f"preferences-{role.lower()}@example.com")
            contexts.append(context)
        for context in contexts:
            with self.subTest(role=context.membership.role):
                preference = update_interface_preferences(context, True)
                self.assertEqual(preference.owner_id, context.membership.pk)
                self.assertTrue(get_interface_preferences(context).sidebar_collapsed)

    def test_denies_stale_revoked_inactive_malformed_cross_workspace_and_superuser_contexts(self):
        _, revoked_context = self.member_context(Membership.Role.OPERATIONAL, "preferences-revoked@example.com")
        remove_membership(workspace_id=self.workspace.pk, membership_id=revoked_context.membership.pk, actor=self.owner)
        inactive_user, inactive_context = self.member_context(Membership.Role.ADMINISTRATIVE, "preferences-inactive@example.com")
        inactive_user.is_active = False
        inactive_user.save(update_fields=["is_active"])
        other = create_workspace_with_owner(owner=User.objects.create_user(email="preferences-other@example.com", password="password"), name="Cross Preferences", slug="cross-preferences")
        cross_context = ActiveWorkspaceContext(other, self.owner_membership)
        missing_context = ActiveWorkspaceContext(self.workspace, Membership(pk=999998, workspace=self.workspace, user=self.owner, role=Membership.Role.OWNER))
        superuser = User.objects.create_superuser(email="preferences-superuser@example.com", password="password")
        superuser_context = ActiveWorkspaceContext(self.workspace, Membership(pk=999999, workspace=self.workspace, user=superuser, role=Membership.Role.OWNER))
        for context in (revoked_context, inactive_context, object(), None, cross_context, missing_context, superuser_context):
            with self.subTest(context=context):
                with self.assertRaises(InterfacePreferenceAccessDenied):
                    get_interface_preferences(context)

    def test_orm_writes_cannot_bypass_the_preference_service(self):
        preference = get_interface_preferences(self.context)
        preference.sidebar_collapsed = True
        with self.assertRaises(InterfacePreferenceWriteBoundaryViolation):
            preference.save()
        with self.assertRaises(InterfacePreferenceWriteBoundaryViolation):
            preference.delete()
        for manager in (MembershipInterfacePreference.objects, MembershipInterfacePreference._base_manager):
            with self.subTest(manager=manager):
                with self.assertRaises(InterfacePreferenceWriteBoundaryViolation):
                    manager.filter(pk=preference.pk).update(sidebar_collapsed=True)
                with self.assertRaises(InterfacePreferenceWriteBoundaryViolation):
                    manager.filter(pk=preference.pk).delete()
        with self.assertRaises(InterfacePreferenceWriteBoundaryViolation):
            MembershipInterfacePreference.objects.bulk_update([preference], ["sidebar_collapsed"])
        with self.assertRaises(InterfacePreferenceWriteBoundaryViolation):
            MembershipInterfacePreference.objects.bulk_create([
                MembershipInterfacePreference(owner=self.owner_membership),
            ])
        with self.assertRaises(InterfacePreferenceWriteBoundaryViolation):
            MembershipInterfacePreference.objects.create(owner=self.owner_membership)
    def test_membership_removal_cascades_its_profile_without_weakening_last_owner_protection(self):
        _, member_context = self.member_context(Membership.Role.OPERATIONAL, "preferences-removal@example.com")
        preference = get_interface_preferences(member_context)
        remove_membership(workspace_id=self.workspace.pk, membership_id=member_context.membership.pk, actor=self.owner)
        self.assertFalse(MembershipInterfacePreference.objects.filter(pk=preference.pk).exists())
        owner_preference = get_interface_preferences(self.context)
        with self.assertRaises(LastOwnerViolation):
            remove_membership(workspace_id=self.workspace.pk, membership_id=self.owner_membership.pk, actor=self.owner)
        self.assertTrue(MembershipInterfacePreference.objects.filter(pk=owner_preference.pk).exists())


class InterfacePreferenceMySQLIntegrityTests(TransactionTestCase):
    reset_sequences = True

    def setUp(self):
        self.owner = User.objects.create_user(email="preferences-sql@example.com", password="password")
        self.workspace = create_workspace_with_owner(owner=self.owner, name="SQL Preferences", slug="sql-preferences")
        self.membership = Membership.objects.get(workspace=self.workspace, user=self.owner)
        self.preference = get_interface_preferences(ActiveWorkspaceContext(self.workspace, self.membership))

    def test_raw_sql_rejects_duplicate_owner_and_invalid_boolean(self):
        other = Membership.objects.create(workspace=self.workspace, user=User.objects.create_user(email="preferences-sql-other@example.com", password="password"), role=Membership.Role.OPERATIONAL)
        table = connection.ops.quote_name(MembershipInterfacePreference._meta.db_table)
        with connection.cursor() as cursor:
            for owner_id, collapsed in ((self.membership.pk, False), (other.pk, 2)):
                with self.subTest(owner_id=owner_id, collapsed=collapsed):
                    with self.assertRaises(DatabaseError), transaction.atomic():
                        cursor.execute(f"INSERT INTO {table} (owner_id, sidebar_collapsed, created_at, updated_at) VALUES (%s, %s, NOW(), NOW())", [owner_id, collapsed])


class InterfacePreferenceConcurrencyTests(TransactionTestCase):
    reset_sequences = True

    def setUp(self):
        self.owner = User.objects.create_user(email="preferences-concurrent@example.com", password="password")
        self.workspace = create_workspace_with_owner(owner=self.owner, name="Concurrent Preferences", slug="concurrent-preferences")
        self.membership = Membership.objects.get(workspace=self.workspace, user=self.owner)

    def test_removal_race_returns_access_denied_instead_of_success(self):
        member = Membership.objects.create(
            workspace=self.workspace,
            user=User.objects.create_user(email="preferences-race@example.com", password="password"),
            role=Membership.Role.OPERATIONAL,
        )
        context = ActiveWorkspaceContext(self.workspace, member)
        barrier = Barrier(2)

        def remove_after_lock():
            close_old_connections()
            try:
                with transaction.atomic():
                    Membership.objects.select_for_update().get(pk=member.pk)
                    barrier.wait()
                    remove_membership(
                        workspace_id=self.workspace.pk,
                        membership_id=member.pk,
                        actor=self.owner,
                    )
            finally:
                close_old_connections()

        def get_after_removal_begins():
            close_old_connections()
            try:
                barrier.wait()
                return get_interface_preferences(context)
            finally:
                close_old_connections()

        with ThreadPoolExecutor(max_workers=2) as pool:
            removal = pool.submit(remove_after_lock)
            access = pool.submit(get_after_removal_begins)
            removal.result()
            with self.assertRaises(InterfacePreferenceAccessDenied):
                access.result()
        self.assertFalse(MembershipInterfacePreference.objects.filter(owner_id=member.pk).exists())
    def test_concurrent_initial_get_and_update_leave_one_profile(self):
        context = ActiveWorkspaceContext(self.workspace, self.membership)
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(lambda operation: operation(context), (get_interface_preferences, lambda active_context: update_interface_preferences(active_context, True))))
        self.assertEqual(len(results), 2)
        self.assertEqual(MembershipInterfacePreference.objects.filter(owner=self.membership).count(), 1)
