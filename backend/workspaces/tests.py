import uuid
from unittest.mock import patch

from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.db.models.deletion import ProtectedError
from django.test import TestCase
from django.contrib.admin.sites import AdminSite

from accounts.models import User
from workspaces.admin import MembershipAdmin
from workspaces.models import Membership, MembershipWriteBoundaryViolation, Workspace
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
