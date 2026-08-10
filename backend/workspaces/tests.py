import uuid
from unittest.mock import patch

from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.db.models.deletion import ProtectedError
from django.test import RequestFactory, TestCase
from django.contrib.admin.sites import AdminSite

from accounts.models import User
from workspaces.admin import MembershipAdmin
from workspaces.context import (
    ACTIVE_WORKSPACE_SESSION_KEY,
    ActiveWorkspaceMembershipRequired,
    InactiveWorkspaceUser,
    NoActiveWorkspaceContext,
    WorkspaceContextSelectionDenied,
    resolve_active_workspace_context,
    select_active_workspace,
)
from workspaces.models import Membership, MembershipWriteBoundaryViolation, Workspace
from workspaces.permissions import (
    WorkspacePermissionDenied,
    can_manage_workspace_memberships,
    can_perform_operational_work,
    can_resolve_workspace_context,
    require_workspace_permission,
)
from workspaces.services import (
    LastOwnerViolation,
    change_membership_role,
    create_workspace_with_owner,
    remove_membership,
)


class WorkspaceMembershipServiceTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user("owner@example.com", "password")

    def create_workspace(self, slug="acme"):
        return create_workspace_with_owner(
            name="Acme Studio",
            slug=slug,
            owner=self.owner,
        )

    def test_workspace_has_public_uuid_and_timestamps(self):
        workspace = self.create_workspace()

        self.assertIsInstance(workspace.public_id, uuid.UUID)
        self.assertIsNotNone(workspace.created_at)
        self.assertIsNotNone(workspace.updated_at)
        self.assertEqual(workspace.slug, "acme")

    def test_creation_creates_exactly_one_owner(self):
        workspace = self.create_workspace()

        memberships = Membership.objects.filter(workspace=workspace)
        self.assertEqual(memberships.count(), 1)
        self.assertEqual(memberships.get().user, self.owner)
        self.assertEqual(memberships.get().role, Membership.Role.OWNER)

    def test_duplicate_workspace_user_membership_is_rejected(self):
        workspace = self.create_workspace()

        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Membership.objects.create(
                    workspace=workspace,
                    user=self.owner,
                    role=Membership.Role.OWNER,
                )

    def test_invalid_roles_are_rejected(self):
        workspace = self.create_workspace()
        membership = Membership.objects.get(workspace=workspace, user=self.owner)

        with self.assertRaises(ValueError):
            change_membership_role(
                workspace_id=workspace.id,
                membership_id=membership.id,
                role="INVALID",
            )

        membership.role = "INVALID"
        with self.assertRaises(ValidationError):
            membership.full_clean()

    def test_last_owner_cannot_be_demoted(self):
        workspace = self.create_workspace()
        membership = Membership.objects.get(workspace=workspace, user=self.owner)

        with self.assertRaises(LastOwnerViolation):
            change_membership_role(
                workspace_id=workspace.id,
                membership_id=membership.id,
                role=Membership.Role.ADMINISTRATIVE,
            )

        membership.refresh_from_db()
        self.assertEqual(membership.role, Membership.Role.OWNER)

    def test_last_owner_cannot_be_removed(self):
        workspace = self.create_workspace()
        membership = Membership.objects.get(workspace=workspace, user=self.owner)

        with self.assertRaises(LastOwnerViolation):
            remove_membership(
                workspace_id=workspace.id,
                membership_id=membership.id,
            )

        self.assertTrue(Membership.objects.filter(pk=membership.pk).exists())

    def test_second_owner_can_be_demoted(self):
        workspace = self.create_workspace()
        second_owner = User.objects.create_user("second-owner@example.com", "password")
        membership = Membership.objects.create(
            workspace=workspace,
            user=second_owner,
            role=Membership.Role.OWNER,
        )

        change_membership_role(
            workspace_id=workspace.id,
            membership_id=membership.id,
            role=Membership.Role.ADMINISTRATIVE,
        )

        membership.refresh_from_db()
        self.assertEqual(membership.role, Membership.Role.ADMINISTRATIVE)
        self.assertEqual(
            Membership.objects.filter(
                workspace=workspace,
                role=Membership.Role.OWNER,
            ).count(),
            1,
        )

    def test_second_owner_can_be_removed(self):
        workspace = self.create_workspace()
        second_owner = User.objects.create_user("removable-owner@example.com", "password")
        membership = Membership.objects.create(
            workspace=workspace,
            user=second_owner,
            role=Membership.Role.OWNER,
        )

        remove_membership(
            workspace_id=workspace.id,
            membership_id=membership.id,
        )

        self.assertFalse(Membership.objects.filter(pk=membership.pk).exists())
        self.assertEqual(
            Membership.objects.filter(
                workspace=workspace,
                role=Membership.Role.OWNER,
            ).count(),
            1,
        )

    def test_rollback_leaves_no_workspace_without_owner(self):
        with patch(
            "workspaces.services.Membership.objects.create",
            side_effect=IntegrityError,
        ):
            with self.assertRaises(IntegrityError):
                create_workspace_with_owner(
                    name="Rollback Studio",
                    slug="rollback-studio",
                    owner=self.owner,
                )

        self.assertFalse(Workspace.objects.filter(slug="rollback-studio").exists())

    def test_memberships_are_isolated_by_workspace(self):
        first_workspace = self.create_workspace("first")
        second_workspace = create_workspace_with_owner(
            name="Second Studio",
            slug="second",
            owner=User.objects.create_user("second@example.com", "password"),
        )
        first_membership = Membership.objects.get(
            workspace=first_workspace,
            user=self.owner,
        )

        with self.assertRaises(Membership.DoesNotExist):
            remove_membership(
                workspace_id=second_workspace.id,
                membership_id=first_membership.id,
            )

        self.assertTrue(Membership.objects.filter(pk=first_membership.pk).exists())

    def test_queryset_update_cannot_demote_an_owner(self):
        workspace = self.create_workspace()
        membership = Membership.objects.get(workspace=workspace, user=self.owner)

        with self.assertRaises(MembershipWriteBoundaryViolation):
            Membership.objects.filter(pk=membership.pk).update(
                role=Membership.Role.ADMINISTRATIVE,
            )

        membership.refresh_from_db()
        self.assertEqual(membership.role, Membership.Role.OWNER)

    def test_queryset_delete_cannot_remove_an_owner(self):
        workspace = self.create_workspace()
        membership = Membership.objects.get(workspace=workspace, user=self.owner)

        with self.assertRaises(MembershipWriteBoundaryViolation):
            Membership.objects.filter(pk=membership.pk).delete()

        self.assertTrue(Membership.objects.filter(pk=membership.pk).exists())

    def test_instance_save_cannot_demote_an_owner_outside_the_service(self):
        workspace = self.create_workspace()
        membership = Membership.objects.get(workspace=workspace, user=self.owner)
        membership.role = Membership.Role.ADMINISTRATIVE

        with self.assertRaises(MembershipWriteBoundaryViolation):
            membership.save(update_fields=["role"])

        membership.refresh_from_db()
        self.assertEqual(membership.role, Membership.Role.OWNER)

    def test_instance_delete_cannot_remove_an_owner_outside_the_service(self):
        workspace = self.create_workspace()
        membership = Membership.objects.get(workspace=workspace, user=self.owner)

        with self.assertRaises(MembershipWriteBoundaryViolation):
            membership.delete()

        self.assertTrue(Membership.objects.filter(pk=membership.pk).exists())

    def test_membership_admin_is_read_only(self):
        admin = MembershipAdmin(Membership, AdminSite())

        self.assertFalse(admin.has_add_permission(None))
        self.assertFalse(admin.has_change_permission(None))
        self.assertFalse(admin.has_delete_permission(None))

    def test_deleting_user_instance_with_membership_is_protected(self):
        workspace = self.create_workspace()
        membership = Membership.objects.get(workspace=workspace, user=self.owner)

        with self.assertRaises(ProtectedError):
            self.owner.delete()

        self.assertTrue(Workspace.objects.filter(pk=workspace.pk).exists())
        self.assertTrue(Membership.objects.filter(pk=membership.pk).exists())

    def test_deleting_user_queryset_with_membership_is_protected(self):
        workspace = self.create_workspace()
        membership = Membership.objects.get(workspace=workspace, user=self.owner)

        with self.assertRaises(ProtectedError):
            User.objects.filter(pk=self.owner.pk).delete()

        self.assertTrue(Workspace.objects.filter(pk=workspace.pk).exists())
        self.assertTrue(Membership.objects.filter(pk=membership.pk).exists())

    def test_deleting_workspace_cascades_to_memberships(self):
        workspace = self.create_workspace()
        membership = Membership.objects.get(workspace=workspace, user=self.owner)

        workspace.delete()

        self.assertFalse(Workspace.objects.filter(pk=workspace.pk).exists())
        self.assertFalse(Membership.objects.filter(pk=membership.pk).exists())


class ActiveWorkspaceContextTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user("context-user@example.com", "password")
        self.request_factory = RequestFactory()

    def request_for(self, user):
        request = self.request_factory.get("/")
        request.user = user
        request.session = {}
        return request

    def create_workspace(self, *, owner, slug):
        return create_workspace_with_owner(
            name=f"{slug.title()} Studio",
            slug=slug,
            owner=owner,
        )

    def test_user_with_multiple_workspaces_requires_explicit_active_context(self):
        first_workspace = self.create_workspace(owner=self.user, slug="first-context")
        second_workspace = self.create_workspace(
            owner=User.objects.create_user("other-owner@example.com", "password"),
            slug="second-context",
        )
        Membership.objects.create(
            workspace=second_workspace,
            user=self.user,
            role=Membership.Role.OPERATIONAL,
        )
        request = self.request_for(self.user)

        with self.assertRaises(NoActiveWorkspaceContext):
            resolve_active_workspace_context(request)

        self.assertNotIn(ACTIVE_WORKSPACE_SESSION_KEY, request.session)
        self.assertTrue(
            Membership.objects.filter(
                workspace=first_workspace,
                user=self.user,
            ).exists()
        )

    def test_selects_an_explicit_owned_workspace_by_public_id(self):
        workspace = self.create_workspace(owner=self.user, slug="selected-context")
        request = self.request_for(self.user)

        context = select_active_workspace(request, workspace.public_id)

        self.assertEqual(context.workspace, workspace)
        self.assertEqual(context.membership.user, self.user)
        self.assertEqual(
            request.session[ACTIVE_WORKSPACE_SESSION_KEY],
            str(workspace.public_id),
        )

    def test_rejects_foreign_and_nonexistent_workspace_selection(self):
        foreign_workspace = self.create_workspace(
            owner=User.objects.create_user("foreign-owner@example.com", "password"),
            slug="foreign-context",
        )
        request = self.request_for(self.user)

        for public_id in (foreign_workspace.public_id, uuid.uuid4()):
            with self.subTest(public_id=public_id):
                with self.assertRaises(WorkspaceContextSelectionDenied):
                    select_active_workspace(request, public_id)

        self.assertNotIn(ACTIVE_WORKSPACE_SESSION_KEY, request.session)

    def test_foreign_and_unknown_selection_have_indistinguishable_errors(self):
        foreign_workspace = self.create_workspace(
            owner=User.objects.create_user("foreign-owner@example.com", "password"),
            slug="indistinguishable-context",
        )
        request = self.request_for(self.user)
        errors = []

        for public_id in (uuid.uuid4(), foreign_workspace.public_id):
            with self.subTest(public_id=public_id):
                with self.assertRaises(WorkspaceContextSelectionDenied) as raised:
                    select_active_workspace(request, public_id)
                errors.append(raised.exception)

        self.assertIs(type(errors[0]), type(errors[1]))
        self.assertEqual(str(errors[0]), str(errors[1]))
        self.assertNotIn(ACTIVE_WORKSPACE_SESSION_KEY, request.session)
    def test_malformed_selection_matches_other_controlled_denials(self):
        foreign_workspace = self.create_workspace(
            owner=User.objects.create_user("foreign-owner@example.com", "password"),
            slug="malformed-selection-context",
        )
        request = self.request_for(self.user)
        errors = []

        for public_id in (uuid.uuid4(), foreign_workspace.public_id, "not-a-uuid"):
            with self.subTest(public_id=public_id):
                with self.assertRaises(WorkspaceContextSelectionDenied) as raised:
                    select_active_workspace(request, public_id)
                errors.append(raised.exception)

        for error in errors[1:]:
            self.assertIs(type(error), type(errors[0]))
            self.assertEqual(str(error), str(errors[0]))
        self.assertNotIn(ACTIVE_WORKSPACE_SESSION_KEY, request.session)
    def test_revoked_membership_invalidates_the_selected_context(self):
        workspace = self.create_workspace(
            owner=User.objects.create_user("workspace-owner@example.com", "password"),
            slug="revoked-context",
        )
        membership = Membership.objects.create(
            workspace=workspace,
            user=self.user,
            role=Membership.Role.OPERATIONAL,
        )
        request = self.request_for(self.user)
        select_active_workspace(request, workspace.public_id)
        remove_membership(workspace_id=workspace.id, membership_id=membership.id)

        with self.assertRaises(ActiveWorkspaceMembershipRequired):
            resolve_active_workspace_context(request)

        self.assertNotIn(ACTIVE_WORKSPACE_SESSION_KEY, request.session)

    def test_inactive_user_invalidates_the_selected_context(self):
        workspace = self.create_workspace(owner=self.user, slug="inactive-context")
        request = self.request_for(self.user)
        select_active_workspace(request, workspace.public_id)
        self.user.is_active = False
        self.user.save(update_fields=["is_active"])

        with self.assertRaises(InactiveWorkspaceUser):
            resolve_active_workspace_context(request)

        self.assertNotIn(ACTIVE_WORKSPACE_SESSION_KEY, request.session)

    def test_stale_session_public_id_clears_context_without_workspace_fallback(self):
        workspace = self.create_workspace(owner=self.user, slug="stale-context")
        request = self.request_for(self.user)
        request.session[ACTIVE_WORKSPACE_SESSION_KEY] = str(uuid.uuid4())

        with self.assertRaises(NoActiveWorkspaceContext):
            resolve_active_workspace_context(request)

        self.assertNotIn(ACTIVE_WORKSPACE_SESSION_KEY, request.session)
        self.assertTrue(
            Membership.objects.filter(workspace=workspace, user=self.user).exists()
        )

    def test_superuser_without_membership_cannot_select_or_resolve_context(self):
        superuser = User.objects.create_superuser("superuser@example.com", "password")
        workspace = self.create_workspace(
            owner=User.objects.create_user("workspace-owner@example.com", "password"),
            slug="superuser-context",
        )
        request = self.request_for(superuser)

        with self.assertRaises(WorkspaceContextSelectionDenied):
            select_active_workspace(request, workspace.public_id)

        self.assertNotIn(ACTIVE_WORKSPACE_SESSION_KEY, request.session)
        request.session[ACTIVE_WORKSPACE_SESSION_KEY] = str(workspace.public_id)

        with self.assertRaises(ActiveWorkspaceMembershipRequired):
            resolve_active_workspace_context(request)

        self.assertNotIn(ACTIVE_WORKSPACE_SESSION_KEY, request.session)
    def test_role_capability_matrix(self):
        expected_capabilities = {
            Membership.Role.OWNER: (True, True, True),
            Membership.Role.OPERATIONAL: (True, False, True),
            Membership.Role.ADMINISTRATIVE: (True, False, False),
        }

        for role, expected in expected_capabilities.items():
            membership = Membership(role=role)
            with self.subTest(role=role):
                self.assertEqual(
                    (
                        can_resolve_workspace_context(membership),
                        can_manage_workspace_memberships(membership),
                        can_perform_operational_work(membership),
                    ),
                    expected,
                )

        with self.assertRaises(WorkspacePermissionDenied):
            require_workspace_permission(
                Membership(role=Membership.Role.ADMINISTRATIVE),
                can_manage_workspace_memberships,
            )
