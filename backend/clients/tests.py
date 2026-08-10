from datetime import timedelta
from uuid import UUID

from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.db.models.deletion import ProtectedError
from django.test import TestCase
from django.utils import timezone

from accounts.models import User
from clients.models import Client
from workspaces.services import create_workspace_with_owner


class ClientModelTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(email="owner@example.com", password="password")
        self.other_owner = User.objects.create_user(
            email="other@example.com", password="password"
        )
        self.workspace = create_workspace_with_owner(
            name="Primary workspace", slug="primary-workspace", owner=self.owner
        )
        self.other_workspace = create_workspace_with_owner(
            name="Other workspace", slug="other-workspace", owner=self.other_owner
        )

    def client_data(self, **overrides):
        data = {
            "workspace": self.workspace,
            "legal_name": " Acme   Corporation ",
            "client_type": Client.ClientType.COMPANY,
            "tax_identifier": "AB- 12.34",
            "primary_contact_name": " Ada   Lovelace ",
            "primary_contact_email": "ADA@EXAMPLE.COM ",
            "primary_contact_phone": "1234567890",
            "address": "  42   Example Street ",
        }
        data.update(overrides)
        return data

    def create_client(self, **overrides):
        return Client.objects.create(**self.client_data(**overrides))

    def test_client_assigns_opaque_uuid_and_timestamps(self):
        client = self.create_client()

        self.assertIsInstance(client.public_id, UUID)
        self.assertIsNotNone(client.created_at)
        self.assertIsNotNone(client.updated_at)

    def test_client_normalizes_business_and_contact_fields(self):
        client = self.create_client()

        self.assertEqual(client.legal_name, "Acme Corporation")
        self.assertEqual(client.tax_identifier, "AB- 12.34")
        self.assertEqual(client.tax_identifier_normalized, "ab1234")
        self.assertEqual(client.primary_contact_name, "Ada Lovelace")
        self.assertEqual(client.primary_contact_email, "ada@example.com")
        self.assertEqual(client.address, "42 Example Street")

    def test_client_rejects_invalid_email(self):
        client = Client(**self.client_data(primary_contact_email="not-an-email"))

        with self.assertRaises(ValidationError):
            client.full_clean()

    def test_client_rejects_non_numeric_or_wrong_length_phone(self):
        for phone in ("123-4567", "123456", "1234567890123456"):
            with self.subTest(phone=phone):
                client = Client(**self.client_data(primary_contact_phone=phone))

                with self.assertRaises(ValidationError):
                    client.full_clean()

    def test_client_rejects_invalid_tax_identifier(self):
        for tax_identifier in ("---", "AB$123"):
            with self.subTest(tax_identifier=tax_identifier):
                client = Client(**self.client_data(tax_identifier=tax_identifier))

                with self.assertRaises(ValidationError):
                    client.full_clean()

    def test_tax_identifier_is_unique_within_workspace(self):
        self.create_client()

        with self.assertRaises(ValidationError):
            self.create_client(legal_name="Another client")

    def test_same_tax_identifier_is_allowed_in_other_workspace(self):
        self.create_client()

        other_client = self.create_client(
            workspace=self.other_workspace,
            legal_name="Other Acme",
            primary_contact_email="other@example.com",
        )

        self.assertEqual(other_client.workspace, self.other_workspace)

    def test_archive_and_restore_maintain_status_invariant(self):
        client = self.create_client()

        client.archive()
        client.refresh_from_db()
        self.assertEqual(client.status, Client.Status.ARCHIVED)
        self.assertIsNotNone(client.archived_at)

        client.restore()
        client.refresh_from_db()
        self.assertEqual(client.status, Client.Status.ACTIVE)
        self.assertIsNone(client.archived_at)

    def test_database_check_constraint_rejects_invalid_archive_state(self):
        client = self.create_client()

        with self.assertRaises(IntegrityError), transaction.atomic():
            Client.objects.filter(pk=client.pk).update(status=Client.Status.ARCHIVED)

    def test_workspace_deletion_is_protected_when_it_has_clients(self):
        self.create_client()

        with self.assertRaises(ProtectedError):
            self.workspace.delete()

    def test_for_workspace_never_returns_clients_from_other_workspace(self):
        own_client = self.create_client()
        other_client = self.create_client(
            workspace=self.other_workspace,
            legal_name="Other Acme",
            primary_contact_email="other@example.com",
        )

        self.assertEqual(list(Client.objects.for_workspace(self.workspace)), [own_client])
        self.assertNotIn(other_client, Client.objects.for_workspace(self.workspace))