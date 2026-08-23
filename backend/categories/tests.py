from decimal import Decimal
from uuid import UUID, uuid4

from django.core.exceptions import ValidationError
from django.db import DatabaseError, connection, transaction
from django.db.models.deletion import ProtectedError
from django.test import TestCase, TransactionTestCase

from accounts.models import User
from categories.models import Category
from workspaces.services import create_workspace_with_owner


class CategoryModelTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(email="category-owner@example.com", password="password")
        self.workspace = create_workspace_with_owner(owner=self.owner, name="Categories", slug="categories")
        self.other_owner = User.objects.create_user(email="category-other@example.com", password="password")
        self.other_workspace = create_workspace_with_owner(owner=self.other_owner, name="Other Categories", slug="other-categories")

    def category_data(self, **overrides):
        data = {"workspace": self.workspace, "name": "  Travel   and  meals ", "description": "  Track   business travel  ", "default_deductible": True, "monthly_budget": Decimal("250.00"), "status": Category.Status.ACTIVE}
        data.update(overrides)
        return data

    def create_category(self, **overrides):
        return Category.objects.create(**self.category_data(**overrides))

    def test_category_persists_uuid_timestamps_and_normalized_name(self):
        category = self.create_category()
        self.assertIsInstance(category.public_id, UUID)
        self.assertIsNotNone(category.created_at)
        self.assertIsNotNone(category.updated_at)
        self.assertEqual(category.name, "Travel and meals")
        self.assertEqual(category.name_normalized, "travel and meals")
        self.assertEqual(category.description, "Track business travel")

    def test_status_constraint_is_available_after_model_import(self):
        constraint_names = {constraint.name for constraint in Category._meta.constraints}
        self.assertIn("category_status_allowed", constraint_names)

    def test_category_requires_nonnegative_or_null_monthly_budget_and_valid_status(self):
        with self.assertRaises(ValidationError):
            Category(**self.category_data(monthly_budget=Decimal("-0.01"))).full_clean()
        with self.assertRaises(ValidationError):
            Category(**self.category_data(status="ARCHIVED")).full_clean()
        self.assertIsNone(self.create_category(monthly_budget=None).monthly_budget)

    def test_normalized_name_is_unique_per_workspace(self):
        self.create_category()
        with self.assertRaises(ValidationError):
            self.create_category(name="travel and meals", description="Duplicate")
        self.assertEqual(self.create_category(workspace=self.other_workspace).workspace_id, self.other_workspace.pk)

    def test_category_rejects_orm_delete_and_bulk_mutation_bypasses(self):
        category = self.create_category()
        with self.assertRaises(ValidationError):
            category.delete()
        with self.assertRaises(ValidationError):
            Category.objects.filter(pk=category.pk).delete()
        with self.assertRaises(ValidationError):
            Category.objects.filter(pk=category.pk).update(status=Category.Status.INACTIVE)
        with self.assertRaises(ValidationError):
            Category._base_manager.filter(pk=category.pk).delete()

    def test_workspace_deletion_is_protected_when_it_has_categories(self):
        self.create_category()
        with self.assertRaises(ProtectedError):
            self.workspace.delete()


class CategoryMySQLIntegrityTests(TransactionTestCase):
    reset_sequences = True

    def setUp(self):
        self.owner = User.objects.create_user(email="category-sql-owner@example.com", password="password")
        self.workspace = create_workspace_with_owner(owner=self.owner, name="Category SQL", slug="category-sql")
        self.other_owner = User.objects.create_user(email="category-sql-other@example.com", password="password")
        self.other_workspace = create_workspace_with_owner(owner=self.other_owner, name="Other Category SQL", slug="other-category-sql")
        self.category = Category.objects.create(workspace=self.workspace, name="SQL Category", monthly_budget=Decimal("1.00"))

    def test_direct_sql_rejects_invalid_scalars_status_workspace_move_and_delete(self):
        table = connection.ops.quote_name(Category._meta.db_table)
        with connection.cursor() as cursor:
            for statement, params in (
                (f"UPDATE {table} SET monthly_budget = -1.00 WHERE id = %s", [self.category.pk]),
                (f"UPDATE {table} SET default_deductible = 2 WHERE id = %s", [self.category.pk]),
                (f"UPDATE {table} SET name = '' WHERE id = %s", [self.category.pk]),
                (f"UPDATE {table} SET status = 'ARCHIVED' WHERE id = %s", [self.category.pk]),
                (f"UPDATE {table} SET workspace_id = %s WHERE id = %s", [self.other_workspace.pk, self.category.pk]),
                (f"DELETE FROM {table} WHERE id = %s", [self.category.pk]),
            ):
                with self.subTest(statement=statement):
                    with self.assertRaises(DatabaseError), transaction.atomic():
                        cursor.execute(statement, params)

    def test_direct_sql_normalizes_name_before_persisting(self):
        table = connection.ops.quote_name(Category._meta.db_table)
        with connection.cursor() as cursor:
            cursor.execute(f"""INSERT INTO {table} (workspace_id, public_id, name, name_normalized, description, default_deductible, monthly_budget, status, created_at, updated_at) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW())""", [self.workspace.pk, uuid4().hex, "  SQL   Travel  ", "not trusted", "  Raw   description  ", False, Decimal("0.00"), Category.Status.ACTIVE])
        raw_category = Category.objects.get(name="SQL Travel")
        self.assertEqual(raw_category.name_normalized, "sql travel")
        self.assertEqual(raw_category.description, "Raw description")

    def test_mysql_trigger_definitions_exist(self):
        with connection.cursor() as cursor:
            cursor.execute("SELECT TRIGGER_NAME FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = DATABASE() AND EVENT_OBJECT_TABLE = 'categories_category' ORDER BY TRIGGER_NAME")
            self.assertEqual([row[0] for row in cursor.fetchall()], ["category_normalize_validate_insert", "category_normalize_validate_update", "category_no_delete"])
