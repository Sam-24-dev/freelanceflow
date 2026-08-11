from decimal import Decimal
from queue import Queue
from threading import Barrier, Thread
from traceback import format_exc

from django.core.exceptions import ValidationError
from django.db import DatabaseError, IntegrityError, connection, close_old_connections, transaction
from django.db.models.deletion import ProtectedError
from django.test import TestCase, TransactionTestCase

from accounts.models import User
from fiscal.models import FiscalConfiguration
from fiscal.services import FiscalAccessDenied, create_fiscal_configuration, get_current_fiscal_configuration
from workspaces.context import ActiveWorkspaceContext
from workspaces.models import Membership
from workspaces.services import create_workspace_with_owner


class FiscalConfigurationTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(email="fiscal-owner@example.com", password="password")
        self.workspace = create_workspace_with_owner(owner=self.owner, name="Fiscal One", slug="fiscal-one")
        self.context = ActiveWorkspaceContext(
            workspace=self.workspace,
            membership=Membership.objects.get(workspace=self.workspace, user=self.owner),
        )
        self.other_owner = User.objects.create_user(email="fiscal-other@example.com", password="password")
        self.other_workspace = create_workspace_with_owner(owner=self.other_owner, name="Fiscal Two", slug="fiscal-two")
        self.other_context = ActiveWorkspaceContext(
            workspace=self.other_workspace,
            membership=Membership.objects.get(workspace=self.other_workspace, user=self.other_owner),
        )

    def create_version(self, **overrides):
        payload = {
            "legal_name": "Acme LLC",
            "tax_identifier": "EC-123",
            "tax_regime": "GENERAL",
            "applies_vat": True,
            "vat_rate": Decimal("15.00"),
            "withholding_rate": Decimal("2.00"),
        }
        payload.update(overrides)
        return create_fiscal_configuration(self.context, **payload)

    def test_authorized_service_creates_immediate_sequential_versions_and_current_read(self):
        first = self.create_version()
        second = self.create_version(legal_name="Acme Updated")
        self.assertEqual((first.version, second.version), (1, 2))
        self.assertEqual(get_current_fiscal_configuration(self.context).pk, second.pk)
        self.assertIsNotNone(first.public_id)
        self.assertIsNotNone(first.created_at)

    def test_vat_rules_and_rate_ranges_are_rejected_by_model_and_mysql(self):
        invalid = FiscalConfiguration(
            workspace=self.workspace, version=1, legal_name="Acme", tax_identifier="EC-1", tax_regime="GENERAL",
            applies_vat=False, vat_rate=Decimal("1.00"), withholding_rate=Decimal("0.00"),
        )
        with self.assertRaises(ValidationError):
            invalid.full_clean()
        with self.assertRaises(ValidationError):
            self.create_version(vat_rate=Decimal("101.00"))
        with connection.cursor() as cursor:
            with self.assertRaises(DatabaseError), transaction.atomic():
                cursor.execute(
                    "INSERT INTO fiscal_fiscalconfiguration (workspace_id, version, public_id, legal_name, tax_identifier, tax_regime, applies_vat, vat_rate, withholding_rate, created_at, updated_at) VALUES (%s, 1, REPLACE(UUID(), '-', ''), 'SQL', 'SQL-1', 'GENERAL', 0, 1.00, 0.00, NOW(), NOW())",
                    [self.workspace.pk],
                )

    def test_mysql_trigger_rejects_non_sequential_direct_sql_version(self):
        self.create_version()

        with connection.cursor() as cursor:
            with self.assertRaises(DatabaseError), transaction.atomic():
                cursor.execute(
                    "INSERT INTO fiscal_fiscalconfiguration (workspace_id, version, public_id, legal_name, tax_identifier, tax_regime, applies_vat, vat_rate, withholding_rate, created_at, updated_at) VALUES (%s, 999, REPLACE(UUID(), '-', ''), 'SQL', 'SQL-999', 'GENERAL', 1, 15.00, 0.00, NOW(), NOW())",
                    [self.workspace.pk],
                )

        self.assertEqual(self.create_version(legal_name="Acme Version Two").version, 2)

    def test_immutable_through_instance_managers_bulk_and_direct_sql(self):
        config = self.create_version()
        config.legal_name = "Changed"
        with self.assertRaises(ValidationError):
            config.save()
        with self.assertRaises(ValidationError):
            FiscalConfiguration.objects.filter(pk=config.pk).update(legal_name="Changed")
        with self.assertRaises(ValidationError):
            FiscalConfiguration._base_manager.filter(pk=config.pk).update(legal_name="Changed")
        with self.assertRaises(ValidationError):
            FiscalConfiguration.objects.bulk_update([config], ["legal_name"])
        with self.assertRaises(ValidationError):
            FiscalConfiguration._base_manager.bulk_create([config])
        with self.assertRaises(ValidationError):
            config.delete()
        with self.assertRaises(ValidationError):
            FiscalConfiguration._base_manager.filter(pk=config.pk).delete()
        with connection.cursor() as cursor:
            with self.assertRaises(DatabaseError), transaction.atomic():
                cursor.execute("UPDATE fiscal_fiscalconfiguration SET legal_name = 'Changed' WHERE id = %s", [config.pk])
            with self.assertRaises(DatabaseError), transaction.atomic():
                cursor.execute("DELETE FROM fiscal_fiscalconfiguration WHERE id = %s", [config.pk])

    def test_roles_context_and_workspace_isolation_are_enforced_without_superuser_bypass(self):
        admin = User.objects.create_user(email="fiscal-admin@example.com", password="password", is_superuser=True)
        membership = Membership.objects.create(workspace=self.workspace, user=admin, role=Membership.Role.ADMINISTRATIVE)
        admin_context = ActiveWorkspaceContext(workspace=self.workspace, membership=membership)
        with self.assertRaises(FiscalAccessDenied):
            create_fiscal_configuration(admin_context, legal_name="No", tax_identifier="NO", tax_regime="GENERAL", applies_vat=False, vat_rate=Decimal("0"), withholding_rate=Decimal("0"))
        config = self.create_version()
        other_config = create_fiscal_configuration(
            self.other_context, legal_name="Other", tax_identifier="OTHER", tax_regime="GENERAL",
            applies_vat=False, vat_rate=Decimal("0"), withholding_rate=Decimal("0"),
        )
        self.assertEqual(get_current_fiscal_configuration(self.context).pk, config.pk)
        self.assertEqual(get_current_fiscal_configuration(self.other_context).pk, other_config.pk)
        with self.assertRaises(FiscalAccessDenied):
            create_fiscal_configuration(self.other_context, legal_name="Other", tax_identifier="OTHER", tax_regime="GENERAL", applies_vat=False, vat_rate=Decimal("0"), withholding_rate=Decimal("0"), workspace=self.workspace)
        with self.assertRaises(ProtectedError):
            self.workspace.delete()

    def test_operational_membership_can_create_versions(self):
        operator = User.objects.create_user(email="fiscal-operator@example.com", password="password")
        membership = Membership.objects.create(workspace=self.workspace, user=operator, role=Membership.Role.OPERATIONAL)
        context = ActiveWorkspaceContext(workspace=self.workspace, membership=membership)
        configuration = create_fiscal_configuration(
            context, legal_name="Operator", tax_identifier="OP-1", tax_regime="GENERAL",
            applies_vat=False, vat_rate=Decimal("0"), withholding_rate=Decimal("0"),
        )
        self.assertEqual(configuration.version, 1)

    def test_mysql_trigger_definitions_exist(self):
        with connection.cursor() as cursor:
            cursor.execute("SELECT TRIGGER_NAME FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = DATABASE() AND EVENT_OBJECT_TABLE = 'fiscal_fiscalconfiguration' ORDER BY TRIGGER_NAME")
            self.assertEqual(
                [row[0] for row in cursor.fetchall()],
                ["fiscal_configuration_immutable_delete", "fiscal_configuration_immutable_update", "fiscal_configuration_validate_insert"],
            )


class FiscalConfigurationConcurrencyTests(TransactionTestCase):
    reset_sequences = True
    _trigger_definitions = None
    _trigger_names = (
        "fiscal_configuration_validate_insert",
        "fiscal_configuration_immutable_update",
        "fiscal_configuration_immutable_delete",
    )

    def _fixture_teardown(self):
        if self.__class__._trigger_definitions is None:
            with connection.cursor() as cursor:
                self.__class__._trigger_definitions = []
                for name in self._trigger_names:
                    cursor.execute("SHOW CREATE TRIGGER `{}`".format(name))
                    self.__class__._trigger_definitions.append(cursor.fetchone()[2])
        with connection.cursor() as cursor:
            for name in self._trigger_names:
                cursor.execute("DROP TRIGGER IF EXISTS `{}`".format(name))
        super()._fixture_teardown()
        with connection.cursor() as cursor:
            for definition in self.__class__._trigger_definitions:
                cursor.execute(definition)

    def setUp(self):
        self.owner = User.objects.create_user(email="fiscal-concurrent@example.com", password="password")
        self.workspace = create_workspace_with_owner(owner=self.owner, name="Fiscal Concurrent", slug="fiscal-concurrent")
        self.membership = Membership.objects.get(workspace=self.workspace, user=self.owner)

    def test_concurrent_service_creates_are_serialized_per_workspace(self):
        start = Barrier(2)
        results, errors = Queue(), Queue()

        def worker(label):
            close_old_connections()
            try:
                context = ActiveWorkspaceContext(workspace=self.workspace, membership=Membership.objects.get(pk=self.membership.pk))
                start.wait(timeout=10)
                config = create_fiscal_configuration(context, legal_name="Acme " + label, tax_identifier="EC-" + label, tax_regime="GENERAL", applies_vat=True, vat_rate=Decimal("15"), withholding_rate=Decimal("0"))
                results.put(config.version)
            except Exception:
                errors.put(format_exc())
            finally:
                close_old_connections()

        threads = [Thread(target=worker, args=(label,)) for label in ("A", "B")]
        for thread in threads: thread.start()
        for thread in threads: thread.join(timeout=30)
        self.assertFalse(any(thread.is_alive() for thread in threads))
        self.assertTrue(errors.empty(), list(errors.queue))
        self.assertEqual(sorted(list(results.queue)), [1, 2])
        self.assertEqual(list(FiscalConfiguration.objects.for_workspace(self.workspace).values_list("version", flat=True)), [1, 2])
