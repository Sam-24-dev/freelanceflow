from decimal import Decimal
from uuid import UUID, uuid4

from django.core.exceptions import ValidationError
from django.db import IntegrityError, connection, transaction
from django.db.models.deletion import ProtectedError
from django.test import TestCase
from django.utils import timezone

from accounts.models import User
from services.models import Service
from workspaces.services import create_workspace_with_owner


class ServiceModelTests(TestCase):
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

    def service_data(self, **overrides):
        data = {
            "workspace": self.workspace,
            "name": "  Discovery   workshop  ",
            "description": "  Collaborative   planning session  ",
            "unit_of_measure": Service.UnitOfMeasure.HOUR,
            "rate": Decimal("125.00"),
            "currency": Service.Currency.USD,
        }
        data.update(overrides)
        return data

    def create_service(self, **overrides):
        return Service.objects.create(**self.service_data(**overrides))

    def assert_direct_insert_rejected(self, field, invalid_value):
        table = connection.ops.quote_name(Service._meta.db_table)
        now = timezone.now()

        with self.assertRaises(IntegrityError), transaction.atomic():
            with connection.cursor() as cursor:
                cursor.execute(
                    f"""
                    INSERT INTO {table} (
                        workspace_id, public_id, name, name_normalized, description,
                        unit_of_measure, rate, currency, status, archived_at,
                        created_at, updated_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    [
                        self.workspace.pk,
                        uuid4().hex,
                        "Direct insert service",
                        "direct insert service",
                        "",
                        (
                            invalid_value
                            if field == "unit_of_measure"
                            else Service.UnitOfMeasure.HOUR
                        ),
                        Decimal("10.00"),
                        (
                            invalid_value
                            if field == "currency"
                            else Service.Currency.USD
                        ),
                        Service.Status.ACTIVE,
                        None,
                        now,
                        now,
                    ],
                )

    def test_service_assigns_opaque_uuid_and_timestamps(self):
        service = self.create_service()

        self.assertIsInstance(service.public_id, UUID)
        self.assertIsNotNone(service.created_at)
        self.assertIsNotNone(service.updated_at)

    def test_service_allows_a_zero_decimal_rate(self):
        service = self.create_service(rate=Decimal("0.00"))

        self.assertEqual(service.rate, Decimal("0.00"))

    def test_service_rejects_negative_rate(self):
        service = Service(**self.service_data(rate=Decimal("-0.01")))

        with self.assertRaises(ValidationError):
            service.full_clean()

    def test_service_rejects_invalid_unit_or_currency(self):
        for overrides in (
            {"unit_of_measure": "DAY"},
            {"currency": "EUR"},
        ):
            with self.subTest(overrides=overrides):
                service = Service(**self.service_data(**overrides))

                with self.assertRaises(ValidationError):
                    service.full_clean()

    def test_service_normalizes_name_and_description(self):
        service = self.create_service()

        self.assertEqual(service.name, "Discovery workshop")
        self.assertEqual(service.name_normalized, "discovery workshop")
        self.assertEqual(service.description, "Collaborative planning session")

    def test_name_is_unique_within_workspace(self):
        self.create_service()

        with self.assertRaises(ValidationError):
            self.create_service(description="Other description")

    def test_same_name_is_allowed_in_other_workspace(self):
        self.create_service()

        other_service = self.create_service(workspace=self.other_workspace)

        self.assertEqual(other_service.workspace, self.other_workspace)

    def test_archive_and_restore_maintain_status_invariant(self):
        service = self.create_service()

        service.archive()
        service.refresh_from_db()
        self.assertEqual(service.status, Service.Status.ARCHIVED)
        self.assertIsNotNone(service.archived_at)

        service.restore()
        service.refresh_from_db()
        self.assertEqual(service.status, Service.Status.ACTIVE)
        self.assertIsNone(service.archived_at)

    def test_model_validation_rejects_inconsistent_archive_states(self):
        active_with_timestamp = Service(
            **self.service_data(archived_at=timezone.now())
        )
        archived_without_timestamp = Service(
            **self.service_data(status=Service.Status.ARCHIVED)
        )

        for service in (active_with_timestamp, archived_without_timestamp):
            with self.subTest(status=service.status):
                with self.assertRaises(ValidationError):
                    service.full_clean()

    def test_database_constraints_reject_invalid_rate_and_archive_state(self):
        service = self.create_service()

        with self.assertRaises(IntegrityError), transaction.atomic():
            Service.objects.filter(pk=service.pk).update(rate=Decimal("-0.01"))

        with self.assertRaises(IntegrityError), transaction.atomic():
            Service.objects.filter(pk=service.pk).update(status=Service.Status.ARCHIVED)

    def test_database_constraints_reject_invalid_catalog_values_on_update(self):
        service = self.create_service()

        for field, invalid_value in (
            ("currency", "EUR"),
            ("unit_of_measure", "DAY"),
        ):
            with self.subTest(field=field):
                with self.assertRaises(IntegrityError), transaction.atomic():
                    Service.objects.filter(pk=service.pk).update(
                        **{field: invalid_value}
                    )

    def test_database_constraints_reject_invalid_catalog_values_on_direct_insert(self):
        for field, invalid_value in (
            ("currency", "EUR"),
            ("unit_of_measure", "DAY"),
        ):
            with self.subTest(field=field):
                self.assert_direct_insert_rejected(field, invalid_value)

    def test_database_constraints_reject_invalid_catalog_values_on_bulk_create(self):
        for field, invalid_value in (
            ("currency", "EUR"),
            ("unit_of_measure", "DAY"),
        ):
            with self.subTest(field=field):
                service = Service(
                    **self.service_data(
                        name=f"Bulk {field} {invalid_value}",
                        **{field: invalid_value},
                    )
                )

                with self.assertRaises(IntegrityError), transaction.atomic():
                    Service.objects.bulk_create([service])

    def test_workspace_deletion_is_protected_when_it_has_services(self):
        self.create_service()

        with self.assertRaises(ProtectedError):
            self.workspace.delete()

    def test_for_workspace_never_returns_services_from_other_workspace(self):
        own_service = self.create_service()
        other_service = self.create_service(workspace=self.other_workspace)

        self.assertEqual(list(Service.objects.for_workspace(self.workspace)), [own_service])
        self.assertNotIn(other_service, Service.objects.for_workspace(self.workspace))