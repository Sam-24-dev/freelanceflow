import json
from datetime import date, datetime, timedelta, timezone as datetime_timezone
from decimal import Decimal
from uuid import uuid4
from types import SimpleNamespace
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import Client, TestCase
from django.utils import timezone

from clients.models import Client as ClientModel
from categories.models import Category
from categories.services import create_category
from proposals.models import Proposal
from projects.models import Project
from projects.services import archive_project, convert_accepted_proposal, transition_project
from fiscal.services import create_fiscal_configuration
from invoices.models import Invoice, _invoice_service_write_boundary
from invoices.services import create_draft_invoice, issue_invoice, void_invoice
from payments.services import record_payment, reverse_payment
from proposals.services import add_line_item, create_proposal, send_proposal, transition_proposal
from services.models import Service
from workspaces.models import Membership, Workspace, allow_membership_writes
from workspaces.context import ActiveWorkspaceContext
from workspaces.services import remove_membership


class SessionApiTests(TestCase):
    def setUp(self):
        self.email = "member@example.com"
        self.password = "correct-horse-battery-staple"
        get_user_model().objects.create_user(email=self.email, password=self.password)

    def post_json(self, path, payload, **extra):
        return self.client.post(path, data=json.dumps(payload), content_type="application/json", **extra)

    def test_anonymous_session_bootstraps_csrf_and_returns_no_store_json(self):
        response = self.client.get("/api/v1/session/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"data": {"authenticated": False, "active_workspace": None}})
        self.assertEqual(response["Content-Type"], "application/json; charset=utf-8")
        self.assertEqual(response["Cache-Control"], "no-store")
        self.assertIn("csrftoken", response.cookies)

    @patch("api.auth_views.time.time", return_value=1_000_000)
    def test_login_rotates_session_clears_active_workspace_and_sets_absolute_deadline(self, mocked_time):
        session = self.client.session
        session["workspaces.active_workspace_public_id"] = "old-workspace"
        session.save()
        old_session_key = self.client.cookies["sessionid"].value
        response = self.post_json("/api/v1/session/login/", {"email": self.email, "password": self.password})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"data": {"authenticated": True, "active_workspace": None}})
        self.assertNotEqual(self.client.cookies["sessionid"].value, old_session_key)
        self.assertNotIn("workspaces.active_workspace_public_id", self.client.session)
        self.assertEqual(self.client.session["api.auth_expires_at"], 1_028_800)

    def test_login_uses_generic_invalid_credentials_error(self):
        response = self.post_json("/api/v1/session/login/", {"email": self.email, "password": "wrong"})
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json(), {"error": {"code": "invalid_credentials"}})

    def test_login_rejects_invalid_json_media_type_and_oversized_body(self):
        invalid_json = self.client.post("/api/v1/session/login/", data="{", content_type="application/json")
        media_type = self.client.post("/api/v1/session/login/", data="{}", content_type="text/plain")
        oversized = self.client.post("/api/v1/session/login/", data=b"x" * (16 * 1024 + 1), content_type="application/json")
        self.assertEqual(invalid_json.status_code, 400)
        self.assertEqual(invalid_json.json(), {"error": {"code": "invalid_json"}})
        self.assertEqual(media_type.status_code, 415)
        self.assertEqual(media_type.json(), {"error": {"code": "unsupported_media_type"}})
        self.assertEqual(oversized.status_code, 413)
        self.assertEqual(oversized.json(), {"error": {"code": "request_too_large"}})

    def test_login_rejects_non_object_missing_and_unknown_fields(self):
        responses = (
            self.post_json("/api/v1/session/login/", [self.email, self.password]),
            self.post_json("/api/v1/session/login/", {"email": self.email}),
            self.post_json("/api/v1/session/login/", {"email": self.email, "password": self.password, "remember_me": True}),
        )
        for response in responses:
            self.assertEqual(response.status_code, 400)
            self.assertEqual(response.json(), {"error": {"code": "invalid_request"}})

    def test_api_methods_return_json_405_with_allow_header(self):
        response = self.client.get("/api/v1/session/login/")
        self.assertEqual(response.status_code, 405)
        self.assertEqual(response.json(), {"error": {"code": "method_not_allowed"}})
        self.assertEqual(response["Allow"], "POST, OPTIONS")

    def test_login_without_csrf_token_returns_json_csrf_failure(self):
        csrf_client = Client(enforce_csrf_checks=True)
        response = csrf_client.post("/api/v1/session/login/", data=json.dumps({"email": self.email, "password": self.password}), content_type="application/json")
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json(), {"error": {"code": "csrf_failed"}})

    @patch("api.auth_views.time.time", return_value=1_000_000)
    def test_expired_absolute_deadline_flushes_after_server_side_session_write(self, mocked_time):
        self.post_json("/api/v1/session/login/", {"email": self.email, "password": self.password})
        session = self.client.session
        session["server_side_write"] = "does-not-extend-auth"
        session.save()
        mocked_time.return_value = 1_028_801
        response = self.client.get("/api/v1/session/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"data": {"authenticated": False, "active_workspace": None}})
        self.assertEqual(dict(self.client.session.items()), {})

    def test_logout_is_csrf_protected_and_flushes_session(self):
        csrf_client = Client(enforce_csrf_checks=True)
        bootstrap = csrf_client.get("/api/v1/session/")
        token = bootstrap.cookies["csrftoken"].value
        login_response = csrf_client.post("/api/v1/session/login/", data=json.dumps({"email": self.email, "password": self.password}), content_type="application/json", HTTP_X_CSRFTOKEN=token)
        self.assertEqual(login_response.status_code, 200)
        token = login_response.cookies["csrftoken"].value
        rejected = csrf_client.post("/api/v1/session/logout/")
        self.assertEqual(rejected.status_code, 403)
        self.assertEqual(rejected.json(), {"error": {"code": "csrf_failed"}})
        response = csrf_client.post("/api/v1/session/logout/", HTTP_X_CSRFTOKEN=token)
        self.assertEqual(response.status_code, 204)
        self.assertEqual(response.content, b"")
        self.assertEqual(dict(csrf_client.session.items()), {})


class FiscalConfigurationApiTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            email="fiscal-api@example.com", password="correct-horse-battery-staple"
        )
        self.other_user = get_user_model().objects.create_user(
            email="fiscal-other-api@example.com", password="correct-horse-battery-staple"
        )
        self.workspace = Workspace.objects.create(name="Fiscal API Studio", slug="fiscal-api-studio")
        self.membership = Membership.objects.create(
            workspace=self.workspace, user=self.user, role=Membership.Role.OWNER
        )
        self.foreign_workspace = Workspace.objects.create(
            name="Foreign Fiscal API Studio", slug="foreign-fiscal-api-studio"
        )
        Membership.objects.create(
            workspace=self.foreign_workspace, user=self.other_user, role=Membership.Role.OWNER
        )

    def authenticate(self, *, expires_at=1_000_100, workspace=None, user=None):
        self.client.force_login(user or self.user)
        session = self.client.session
        session["api.auth_expires_at"] = expires_at
        if workspace is not None:
            session["workspaces.active_workspace_public_id"] = str(workspace.public_id)
        session.save()

    def create_configuration(self, context=None, **overrides):
        context = context or ActiveWorkspaceContext(self.workspace, self.membership)
        payload = {
            "legal_name": "Fiscal API Studio",
            "tax_identifier": "EC-FISCAL-1",
            "tax_regime": "GENERAL",
            "applies_vat": True,
            "vat_rate": Decimal("15.00"),
            "withholding_rate": Decimal("2.00"),
        }
        payload.update(overrides)
        return create_fiscal_configuration(context, **payload)

    @patch("api.auth_views.time.time", return_value=1_000_000)
    def test_requires_authenticated_live_session_and_active_workspace_context(self, mocked_time):
        self.assertEqual(self.client.get("/api/v1/fiscal-configuration/").status_code, 401)
        self.authenticate(expires_at=999_999, workspace=self.workspace)
        self.assertEqual(self.client.get("/api/v1/fiscal-configuration/").status_code, 401)
        self.authenticate()
        response = self.client.get("/api/v1/fiscal-configuration/")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"error": {"code": "workspace_required"}})
        self.authenticate(workspace=self.foreign_workspace)
        response = self.client.get("/api/v1/fiscal-configuration/")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"error": {"code": "workspace_required"}})

    @patch("api.auth_views.time.time", return_value=1_000_000)
    def test_allows_only_owner_and_operational_memberships_with_fresh_role(self, mocked_time):
        self.authenticate(workspace=self.workspace)
        self.create_configuration()
        for role, status in (
            (Membership.Role.OWNER, 200),
            (Membership.Role.OPERATIONAL, 200),
            (Membership.Role.ADMINISTRATIVE, 403),
        ):
            with allow_membership_writes():
                Membership.objects.filter(pk=self.membership.pk).update(role=role)
            response = self.client.get("/api/v1/fiscal-configuration/")
            self.assertEqual(response.status_code, status)
        superuser = get_user_model().objects.create_superuser(
            email="fiscal-superuser-api@example.com", password="correct-horse-battery-staple"
        )
        self.authenticate(workspace=self.workspace, user=superuser)
        response = self.client.get("/api/v1/fiscal-configuration/")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"error": {"code": "workspace_required"}})

    @patch("api.auth_views.time.time", return_value=1_000_000)
    def test_returns_only_current_configuration_for_active_tenant(self, mocked_time):
        first = self.create_configuration(legal_name="Old Name")
        current = self.create_configuration(legal_name="Current Name")
        foreign_context = ActiveWorkspaceContext(
            self.foreign_workspace,
            Membership.objects.get(workspace=self.foreign_workspace, user=self.other_user),
        )
        foreign = self.create_configuration(foreign_context, legal_name="Foreign Name")
        self.authenticate(workspace=self.workspace)

        response = self.client.get("/api/v1/fiscal-configuration/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Cache-Control"], "no-store")
        item = response.json()["data"]
        self.assertEqual(set(item), {
            "public_id", "version", "legal_name", "tax_identifier", "tax_regime",
            "applies_vat", "vat_rate", "withholding_rate",
        })
        self.assertEqual(item["public_id"], str(current.public_id))
        self.assertEqual(item["version"], current.version)
        self.assertEqual(item["legal_name"], "Current Name")
        self.assertEqual(item["vat_rate"], "15.00")
        self.assertEqual(item["withholding_rate"], "2.00")
        for forbidden in (
            "pk", "id", "workspace", "workspace_id", "created_at", "updated_at",
            "historical_versions", "invoice_data",
        ):
            self.assertNotIn(forbidden, item)
        self.assertNotEqual(first.public_id, current.public_id)
        self.assertNotEqual(foreign.public_id, current.public_id)

    @patch("api.auth_views.time.time", return_value=1_000_000)
    def test_decimal_rates_are_json_strings_without_float_coercion(self, mocked_time):
        self.create_configuration(vat_rate=Decimal("12.34"), withholding_rate=Decimal("0.01"))
        self.authenticate(workspace=self.workspace)

        item = self.client.get("/api/v1/fiscal-configuration/").json()["data"]

        self.assertIsInstance(item["vat_rate"], str)
        self.assertIsInstance(item["withholding_rate"], str)
        self.assertEqual(item["vat_rate"], "12.34")
        self.assertEqual(item["withholding_rate"], "0.01")

    @patch("api.auth_views.time.time", return_value=1_000_000)
    def test_authorized_workspace_without_configuration_returns_contract_404(self, mocked_time):
        self.authenticate(workspace=self.workspace)
        response = self.client.get("/api/v1/fiscal-configuration/")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json(), {"error": {"code": "fiscal_configuration_not_configured"}})

    @patch("api.auth_views.time.time", return_value=1_000_000)
    def test_rejects_query_parameters_and_non_get_methods_as_json(self, mocked_time):
        self.authenticate(workspace=self.workspace)
        response = self.client.get("/api/v1/fiscal-configuration/?workspace=ignored")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"error": {"code": "invalid_request"}})
        response = self.client.post("/api/v1/fiscal-configuration/")
        self.assertEqual(response.status_code, 405)
        self.assertEqual(response.json(), {"error": {"code": "method_not_allowed"}})
        self.assertEqual(response["Allow"], "GET, HEAD, OPTIONS")
        self.assertEqual(response["Cache-Control"], "no-store")


class WorkspaceApiTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            email="member@example.com", password="correct-horse-battery-staple"
        )
        self.other_user = get_user_model().objects.create_user(
            email="other@example.com", password="correct-horse-battery-staple"
        )
        self.workspace = Workspace.objects.create(name="Member Studio", slug="member-studio")
        Membership.objects.create(
            workspace=self.workspace,
            user=self.user,
            role=Membership.Role.ADMINISTRATIVE,
        )
        self.operational_workspace = Workspace.objects.create(
            name="Operational Studio", slug="operational-studio"
        )
        Membership.objects.create(
            workspace=self.operational_workspace,
            user=self.user,
            role=Membership.Role.OPERATIONAL,
        )
        self.owner_workspace = Workspace.objects.create(name="Owner Studio", slug="owner-studio")
        Membership.objects.create(
            workspace=self.owner_workspace,
            user=self.user,
            role=Membership.Role.OWNER,
        )
        self.foreign_workspace = Workspace.objects.create(name="Other Studio", slug="other-studio")
        Membership.objects.create(
            workspace=self.foreign_workspace,
            user=self.other_user,
            role=Membership.Role.OWNER,
        )
        self.revoked_workspace = Workspace.objects.create(name="Revoked Studio", slug="revoked-studio")
        Membership.objects.create(
            workspace=self.revoked_workspace,
            user=self.other_user,
            role=Membership.Role.OWNER,
        )
        revoked_membership = Membership.objects.create(
            workspace=self.revoked_workspace,
            user=self.user,
            role=Membership.Role.OPERATIONAL,
        )
        remove_membership(
            workspace_id=self.revoked_workspace.id,
            membership_id=revoked_membership.id,
            actor=self.other_user,
        )

    def authenticate(self, expires_at=1_000_100):
        self.client.force_login(self.user)
        session = self.client.session
        session["api.auth_expires_at"] = expires_at
        session.save()

    def post_json(self, client, payload, **extra):
        return client.post(
            "/api/v1/workspaces/active/",
            data=json.dumps(payload),
            content_type="application/json",
            **extra,
        )

    @patch("api.auth_views.time.time", return_value=1_000_000)
    def test_list_returns_only_authenticated_callers_memberships_without_query_parameters(self, mocked_time):
        self.authenticate()

        response = self.client.get("/api/v1/workspaces/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"data": {"workspaces": [
            {
                "workspace_public_id": str(self.workspace.public_id),
                "workspace_name": "Member Studio",
                "workspace_slug": "member-studio",
                "role": Membership.Role.ADMINISTRATIVE,
            },
            {
                "workspace_public_id": str(self.operational_workspace.public_id),
                "workspace_name": "Operational Studio",
                "workspace_slug": "operational-studio",
                "role": Membership.Role.OPERATIONAL,
            },
            {
                "workspace_public_id": str(self.owner_workspace.public_id),
                "workspace_name": "Owner Studio",
                "workspace_slug": "owner-studio",
                "role": Membership.Role.OWNER,
            },
        ]}})
        self.assertEqual(response["Cache-Control"], "no-store")

    @patch("api.auth_views.time.time", return_value=1_000_000)
    def test_list_rejects_query_parameters_and_anonymous_or_expired_sessions(self, mocked_time):
        anonymous = self.client.get("/api/v1/workspaces/")
        self.assertEqual(anonymous.status_code, 401)
        self.assertEqual(anonymous.json(), {"error": {"code": "authentication_required"}})

        self.authenticate(expires_at=999_999)
        expired = self.client.get("/api/v1/workspaces/")
        self.assertEqual(expired.status_code, 401)
        self.assertEqual(expired.json(), {"error": {"code": "authentication_required"}})

        self.authenticate()
        query = self.client.get("/api/v1/workspaces/?workspace_public_id=ignored")
        self.assertEqual(query.status_code, 400)
        self.assertEqual(query.json(), {"error": {"code": "invalid_request"}})

    @patch("api.auth_views.time.time", return_value=1_000_000)
    def test_selection_requires_csrf_and_accepts_only_a_canonical_uuid_object(self, mocked_time):
        csrf_client = Client(enforce_csrf_checks=True)
        csrf_client.force_login(self.user)
        session = csrf_client.session
        session["api.auth_expires_at"] = 1_000_100
        session.save()

        csrf_rejected = self.post_json(csrf_client, {"workspace_public_id": str(self.workspace.public_id)})
        self.assertEqual(csrf_rejected.status_code, 403)
        self.assertEqual(csrf_rejected.json(), {"error": {"code": "csrf_failed"}})

        self.authenticate()
        for payload in ([], {}, {"workspace_public_id": "not-a-uuid"}, {"workspace_public_id": str(self.workspace.public_id).upper()}, {"workspace_public_id": str(self.workspace.public_id), "role": "OWNER"}):
            response = self.post_json(self.client, payload)
            self.assertEqual(response.status_code, 400)
            self.assertEqual(response.json(), {"error": {"code": "invalid_request"}})

    @patch("api.auth_views.time.time", return_value=1_000_000)
    def test_selection_returns_one_stable_workspace_identifier_and_preserves_deadline(self, mocked_time):
        self.authenticate()

        response = self.post_json(self.client, {"workspace_public_id": str(self.workspace.public_id)})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"data": {"workspace_public_id": str(self.workspace.public_id)}})
        self.assertEqual(self.client.session["workspaces.active_workspace_public_id"], str(self.workspace.public_id))
        self.assertEqual(self.client.session["api.auth_expires_at"], 1_000_100)

        mocked_time.return_value = 1_000_101
        expired = self.client.get("/api/v1/workspaces/")
        self.assertEqual(expired.status_code, 401)
        self.assertEqual(expired.json(), {"error": {"code": "authentication_required"}})

    @patch("api.auth_views.time.time", return_value=1_000_000)
    def test_foreign_revoked_and_unknown_workspaces_are_indistinguishable_and_never_fall_back(self, mocked_time):
        self.authenticate()
        session = self.client.session
        session["workspaces.active_workspace_public_id"] = str(self.workspace.public_id)
        session.save()

        responses = (
            self.post_json(self.client, {"workspace_public_id": str(self.foreign_workspace.public_id)}),
            self.post_json(self.client, {"workspace_public_id": str(self.revoked_workspace.public_id)}),
            self.post_json(self.client, {"workspace_public_id": "00000000-0000-4000-8000-000000000000"}),
        )
        for response in responses:
            self.assertEqual(response.status_code, 404)
            self.assertEqual(response.json(), {"error": {"code": "workspace_not_available"}})
            self.assertEqual(self.client.session["workspaces.active_workspace_public_id"], str(self.workspace.public_id))

        session = self.client.session
        session.pop("workspaces.active_workspace_public_id", None)
        session.save()
        no_fallback = self.post_json(self.client, {"workspace_public_id": str(self.foreign_workspace.public_id)})
        self.assertEqual(no_fallback.status_code, 404)
        self.assertNotIn("workspaces.active_workspace_public_id", self.client.session)

    def test_workspace_endpoints_use_json_405_responses(self):
        list_post = self.client.post("/api/v1/workspaces/")
        active_get = self.client.get("/api/v1/workspaces/active/")
        self.assertEqual(list_post.status_code, 405)
        self.assertEqual(list_post.json(), {"error": {"code": "method_not_allowed"}})
        self.assertEqual(list_post["Allow"], "GET, HEAD, OPTIONS")
        self.assertEqual(active_get.status_code, 405)
        self.assertEqual(active_get.json(), {"error": {"code": "method_not_allowed"}})
        self.assertEqual(active_get["Allow"], "POST, OPTIONS")


class _FakeNotificationQuerySet:
    def __init__(self, rows):
        self.rows = rows

    def filter(self, *args, **kwargs):
        return type(self)(self.rows[25:])

    def values(self, *fields):
        return self.rows


class NotificationApiTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            email="notifications@example.com", password="correct-horse-battery-staple"
        )
        self.workspace = Workspace.objects.create(name="Notifications", slug="notifications")
        self.membership = Membership.objects.create(
            workspace=self.workspace,
            user=self.user,
            role=Membership.Role.OPERATIONAL,
        )

    def authenticate(self, *, active=True, expires_at=1_000_100):
        self.client.force_login(self.user)
        session = self.client.session
        session["api.auth_expires_at"] = expires_at
        if active:
            session["workspaces.active_workspace_public_id"] = str(self.workspace.public_id)
        session.save()

    @patch("api.auth_views.time.time", return_value=1_000_000)
    def test_requires_api_auth_and_active_workspace(self, mocked_time):
        anonymous = self.client.get("/api/v1/notifications/")
        self.assertEqual(anonymous.status_code, 401)
        self.assertEqual(anonymous.json(), {"error": {"code": "authentication_required"}})

        self.authenticate(active=False)
        missing_workspace = self.client.get("/api/v1/notifications/")
        self.assertEqual(missing_workspace.status_code, 400)
        self.assertEqual(missing_workspace.json(), {"error": {"code": "workspace_required"}})

    @patch("api.auth_views.time.time", return_value=1_000_000)
    def test_empty_list_has_strict_envelope_and_rejects_unknown_query_parameters(self, mocked_time):
        self.authenticate()
        response = self.client.get("/api/v1/notifications/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"data": {"notifications": [], "next_cursor": None}})
        self.assertEqual(response["Cache-Control"], "no-store")

        invalid = self.client.get("/api/v1/notifications/?workspace_public_id=ignored")
        self.assertEqual(invalid.status_code, 400)
        self.assertEqual(invalid.json(), {"error": {"code": "invalid_request"}})


    @patch("api.auth_views.time.time", return_value=1_000_000)
    def test_populated_response_projects_only_recipient_fields(self, mocked_time):
        from api.notification_views import READ_FIELDS

        self.authenticate()
        created_at = timezone.now()
        row = {
            "public_id": uuid4(),
            "kind": "payment.recorded",
            "state": "UNREAD",
            "created_at": created_at,
            "read_at": None,
            "archived_at": None,
            "pk": 1,
            "source_payment_id": 77,
            "recipient_id": 99,
        }
        fake = _FakeNotificationQuerySet([row])
        with patch("api.notification_views.list_notifications", return_value=fake):
            response = self.client.get("/api/v1/notifications/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(set(response.json()["data"]["notifications"][0]), set(READ_FIELDS))
        self.assertNotIn("pk", response.json()["data"]["notifications"][0])
        self.assertNotIn("source_payment_id", response.json()["data"]["notifications"][0])

    @patch("api.auth_views.time.time", return_value=1_000_000)
    def test_recipient_scope_uses_callers_membership(self, mocked_time):
        other_user = get_user_model().objects.create_user(
            email="other-notifications@example.com", password="correct-horse-battery-staple"
        )
        Membership.objects.create(
            workspace=self.workspace,
            user=other_user,
            role=Membership.Role.OPERATIONAL,
        )
        self.authenticate()
        fake = _FakeNotificationQuerySet([])
        with patch("api.notification_views.list_notifications", return_value=fake) as listed:
            response = self.client.get("/api/v1/notifications/")

        self.assertEqual(response.status_code, 200)
        context = listed.call_args.args[0]
        self.assertEqual(context.workspace.pk, self.workspace.pk)
        self.assertEqual(context.membership.pk, self.membership.pk)

    @patch("api.auth_views.time.time", return_value=1_000_000)
    def test_foreign_workspace_and_revoked_membership_are_rejected(self, mocked_time):
        foreign = Workspace.objects.create(name="Foreign", slug="foreign")
        self.authenticate()
        session = self.client.session
        session["workspaces.active_workspace_public_id"] = str(foreign.public_id)
        session.save()
        foreign_response = self.client.get("/api/v1/notifications/")
        self.assertEqual(foreign_response.status_code, 400)
        self.assertEqual(foreign_response.json(), {"error": {"code": "workspace_required"}})

        self.authenticate()
        with allow_membership_writes():
            self.membership.delete()
        revoked_response = self.client.get("/api/v1/notifications/")
        self.assertEqual(revoked_response.status_code, 400)
        self.assertEqual(revoked_response.json(), {"error": {"code": "workspace_required"}})

    @patch("api.auth_views.time.time", return_value=1_000_000)
    @patch("api.notification_views.current_time", return_value=1_000_000)
    def test_tampered_and_wrong_binding_cursors_are_invalid(self, mocked_cursor_time, mocked_auth_time):
        from api.notification_views import AUTH_EXPIRY_SESSION_KEY, CURSOR_SESSION_KEY, CURSOR_SIGNER

        self.authenticate()
        deadline = 1_000_100
        cursor_data = {
            "created_at": timezone.now().isoformat(),
            "pk": 1,
            "workspace": str(self.workspace.public_id),
            "membership": self.membership.pk,
            "subject": str(self.user.pk),
            "deadline": deadline,
        }
        session = self.client.session
        session[AUTH_EXPIRY_SESSION_KEY] = deadline
        session[CURSOR_SESSION_KEY] = {"nonce": cursor_data}
        session.save()
        signed = CURSOR_SIGNER.sign("v1.nonce")

        for mutate in (
            lambda data: data.update(subject="foreign"),
            lambda data: data.update(workspace=str(uuid4())),
            lambda data: data.update(membership=999),
            lambda data: data.update(deadline=999),
        ):
            session = self.client.session
            session[CURSOR_SESSION_KEY] = {"nonce": dict(cursor_data)}
            mutate(session[CURSOR_SESSION_KEY]["nonce"])
            session.save()
            response = self.client.get(f"/api/v1/notifications/?cursor={signed}")
            self.assertEqual(response.status_code, 400)
            self.assertEqual(response.json(), {"error": {"code": "invalid_request"}})

        tampered = self.client.get(f"/api/v1/notifications/?cursor={signed}x")
        self.assertEqual(tampered.status_code, 400)
        self.assertEqual(tampered.json(), {"error": {"code": "invalid_request"}})

        with patch("api.notification_views.current_time", return_value=1_000_101):
            session = self.client.session
            session[CURSOR_SESSION_KEY] = {"nonce": dict(cursor_data)}
            session.save()
            expired = self.client.get(f"/api/v1/notifications/?cursor={signed}")
        self.assertEqual(expired.status_code, 400)
        self.assertEqual(expired.json(), {"error": {"code": "invalid_request"}})

    @patch("api.auth_views.time.time", return_value=1_000_000)
    @patch("api.notification_views.current_time", return_value=1_000_000)
    def test_keyset_page_boundary_is_ordered_without_duplicates_or_misses(self, mocked_cursor_time, mocked_auth_time):
        self.authenticate()
        created_at = timezone.now()
        rows = [
            {
                "public_id": uuid4(),
                "kind": "payment.recorded",
                "state": "UNREAD",
                "created_at": created_at,
                "read_at": None,
                "archived_at": None,
                "pk": pk,
            }
            for pk in range(26, 0, -1)
        ]
        fake = _FakeNotificationQuerySet(rows)
        with patch("api.notification_views.list_notifications", return_value=fake):
            first = self.client.get("/api/v1/notifications/")
            second = self.client.get(
                "/api/v1/notifications/?cursor=" + first.json()["data"]["next_cursor"]
            )

        first_items = first.json()["data"]["notifications"]
        second_items = second.json()["data"]["notifications"]
        self.assertEqual(len(first_items), 25)
        self.assertEqual(len(second_items), 1)
        ids = [item["public_id"] for item in first_items + second_items]
        self.assertEqual(len(ids), len(set(ids)))
        self.assertEqual(second.json()["data"]["next_cursor"], None)


class NotificationCursorStorageTests(TestCase):
    @patch("api.notification_views.current_time", return_value=100)
    def test_cursor_store_prunes_expired_entries_and_caps_live_entries(self, mocked_time):
        from api.notification_views import (
            AUTH_EXPIRY_SESSION_KEY,
            CURSOR_MAX_ENTRIES,
            CURSOR_SESSION_KEY,
            _new_cursor,
        )

        request = SimpleNamespace(
            user=SimpleNamespace(pk=7),
            session={AUTH_EXPIRY_SESSION_KEY: 1_000},
        )
        context = SimpleNamespace(
            workspace=SimpleNamespace(public_id="workspace"),
            membership=SimpleNamespace(pk=3),
        )
        request.session[CURSOR_SESSION_KEY] = {
            "expired": {"deadline": 99},
            **{str(index): {"deadline": 1_000} for index in range(CURSOR_MAX_ENTRIES)},
        }

        _new_cursor(request, context, {"created_at": timezone.now(), "pk": 999})

        cursors = request.session[CURSOR_SESSION_KEY]
        self.assertEqual(len(cursors), CURSOR_MAX_ENTRIES)
        self.assertNotIn("expired", cursors)
        self.assertNotIn("0", cursors)


class ClientApiTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            email="clients-api@example.com", password="correct-horse-battery-staple"
        )
        self.workspace = Workspace.objects.create(name="Client Studio", slug="client-studio")
        self.membership = Membership.objects.create(
            workspace=self.workspace, user=self.user, role=Membership.Role.OWNER
        )

    def authenticate(self, *, expires_at=1_000_100, workspace=None):
        self.client.force_login(self.user)
        session = self.client.session
        session["api.auth_expires_at"] = expires_at
        if workspace is not None:
            session["workspaces.active_workspace_public_id"] = str(workspace.public_id)
        session.save()

    def make_client(self, legal_name, *, workspace=None, status=ClientModel.Status.ACTIVE, archived_at=None, tax_identifier=None):
        return ClientModel.objects.create(
            workspace=workspace or self.workspace,
            legal_name=legal_name,
            client_type=ClientModel.ClientType.COMPANY,
            tax_identifier=tax_identifier or legal_name.replace(" ", "-")[:20],
            primary_contact_name="Primary Contact",
            primary_contact_email=f"{legal_name.replace(' ', '').lower()}@example.com",
            primary_contact_phone="0999999999",
            status=status,
            archived_at=archived_at,
        )

    @patch("api.auth_views.time.time", return_value=1_000_000)
    def test_requires_auth_context(self, mocked_time):
        self.assertEqual(self.client.get("/api/v1/clients/").status_code, 401)
        self.authenticate(workspace=self.workspace, expires_at=999_999)
        self.assertEqual(self.client.get("/api/v1/clients/").status_code, 401)
        self.authenticate()
        self.assertEqual(self.client.get("/api/v1/clients/").json(), {"error": {"code": "workspace_required"}})
        foreign = Workspace.objects.create(name="Foreign", slug="foreign-client-auth")
        self.authenticate(workspace=foreign)
        self.assertEqual(self.client.get("/api/v1/clients/").json(), {"error": {"code": "workspace_required"}})
        revoked_workspace = Workspace.objects.create(name="Revoked", slug="revoked-client-auth")
        revoked = Membership.objects.create(
            workspace=revoked_workspace, user=self.user, role=Membership.Role.OWNER
        )
        self.authenticate(workspace=revoked_workspace)
        with allow_membership_writes():
            revoked.delete()
        self.assertEqual(self.client.get("/api/v1/clients/").json(), {"error": {"code": "workspace_required"}})

    @patch("api.auth_views.time.time", return_value=1_000_000)
    def test_administrative_membership_is_denied(self, mocked_time):
        self.authenticate(workspace=self.workspace)
        with allow_membership_writes():
            Membership.objects.filter(pk=self.membership.pk).update(role=Membership.Role.ADMINISTRATIVE)
        denied = self.client.get("/api/v1/clients/")
        self.assertEqual(denied.status_code, 403)
        self.assertEqual(denied.json(), {"error": {"code": "permission_denied"}})

    @patch("api.auth_views.time.time", return_value=1_000_000)
    def test_projects_scoped_active_and_archived_clients_without_private_fields(self, mocked_time):
        self.authenticate(workspace=self.workspace)
        archived = self.make_client("Archived Client", status=ClientModel.Status.ARCHIVED, archived_at=timezone.now())
        self.make_client("Active Client")
        foreign_workspace = Workspace.objects.create(name="Foreign", slug="foreign-client-api")
        self.make_client("Foreign Client", workspace=foreign_workspace)
        response = self.client.get("/api/v1/clients/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Cache-Control"], "no-store")
        items = response.json()["data"]["items"]
        self.assertEqual([item["legal_name"] for item in items], ["Active Client", "Archived Client"])
        self.assertEqual(set(items[0]), {"public_id", "legal_name", "client_type", "tax_identifier", "primary_contact_name", "primary_contact_email", "primary_contact_phone", "status", "archived_at"})
        self.assertEqual(items[1]["public_id"], str(archived.public_id))
        self.assertEqual(response.json()["data"]["next_cursor"], None)
        self.assertNotIn("address", items[0])
        self.assertNotIn("workspace", items[0])
        with allow_membership_writes():
            Membership.objects.filter(pk=self.membership.pk).update(role=Membership.Role.OPERATIONAL)
        self.assertEqual(self.client.get("/api/v1/clients/").status_code, 200)

    @patch("api.auth_views.time.time", return_value=1_000_000)
    @patch("api.client_views.current_time", return_value=1_000_000)
    def test_cursor_is_bound_and_keyset_pages_twenty_five_without_duplicates(self, mocked_cursor_time, mocked_auth_time):
        self.authenticate(workspace=self.workspace)
        for index in range(26, 0, -1):
            self.make_client(f"Client {index:02d}")
        first = self.client.get("/api/v1/clients/")
        self.assertEqual(first.status_code, 200)
        first_items = first.json()["data"]["items"]
        self.assertEqual(len(first_items), 25)
        cursor = first.json()["data"]["next_cursor"]
        second = self.client.get(f"/api/v1/clients/?cursor={cursor}")
        second_items = second.json()["data"]["items"]
        self.assertEqual(len(second_items), 1)
        self.assertEqual(len({item["public_id"] for item in first_items + second_items}), 26)
        self.assertIsNone(second.json()["data"]["next_cursor"])
        self.assertEqual(self.client.get(f"/api/v1/clients/?cursor={cursor}x").status_code, 400)
        mocked_cursor_time.return_value = 1_000_101
        self.assertEqual(self.client.get(f"/api/v1/clients/?cursor={cursor}").status_code, 400)
        foreign = Workspace.objects.create(name="Other", slug="other-client-api")
        Membership.objects.create(workspace=foreign, user=self.user, role=Membership.Role.OWNER)
        self.authenticate(workspace=foreign)
        self.assertEqual(self.client.get(f"/api/v1/clients/?cursor={cursor}").status_code, 400)
        self.authenticate(workspace=self.workspace, expires_at=999_999)
        self.assertEqual(self.client.get(f"/api/v1/clients/?cursor={cursor}").status_code, 401)

    @patch("api.auth_views.time.time", return_value=1_000_000)
    @patch("api.client_views.current_time", return_value=1_000_000)
    def test_keyset_tie_breaker_pages_duplicate_legal_names_without_misses(self, mocked_cursor_time, mocked_auth_time):
        self.authenticate(workspace=self.workspace)
        clients = [
            self.make_client("Same Name", tax_identifier=f"SAME-{index}")
            for index in range(26)
        ]
        first = self.client.get("/api/v1/clients/")
        second = self.client.get("/api/v1/clients/?cursor=" + first.json()["data"]["next_cursor"])
        first_ids = [item["public_id"] for item in first.json()["data"]["items"]]
        second_ids = [item["public_id"] for item in second.json()["data"]["items"]]
        self.assertEqual(len(first_ids), 25)
        self.assertEqual(second_ids, [str(clients[-1].public_id)])
        self.assertEqual(len(set(first_ids + second_ids)), 26)

    @patch("api.auth_views.time.time", return_value=1_000_000)
    def test_client_cursor_state_prunes_expired_records_and_caps_live_entries(self, mocked_time):
        from api.client_views import AUTH_EXPIRY_SESSION_KEY, CURSOR_MAX_ENTRIES, CURSOR_SESSION_KEY, _new_cursor

        request = SimpleNamespace(
            user=SimpleNamespace(pk=7), session={AUTH_EXPIRY_SESSION_KEY: 1_000}
        )
        context = SimpleNamespace(
            workspace=SimpleNamespace(public_id="workspace"),
            membership=SimpleNamespace(pk=3),
        )
        request.session[CURSOR_SESSION_KEY] = {
            "expired": {"deadline": 99},
            **{str(index): {"deadline": 1_000} for index in range(CURSOR_MAX_ENTRIES)},
        }
        with patch("api.client_views.current_time", return_value=100):
            _new_cursor(request, context, {"legal_name": "Same Name", "pk": 999})
        cursors = request.session[CURSOR_SESSION_KEY]
        self.assertEqual(len(cursors), CURSOR_MAX_ENTRIES)
        self.assertNotIn("expired", cursors)
        self.assertNotIn("0", cursors)

    @patch("api.auth_views.time.time", return_value=1_000_000)
    def test_query_allowlist_and_methods_are_json(self, mocked_time):
        self.authenticate(workspace=self.workspace)
        for path in ("/api/v1/clients/?workspace=ignored", "/api/v1/clients/?cursor=a&cursor=b"):
            response = self.client.get(path)
            self.assertEqual(response.status_code, 400)
            self.assertEqual(response.json(), {"error": {"code": "invalid_request"}})
        response = self.client.post("/api/v1/clients/")
        self.assertEqual(response.status_code, 405)
        self.assertEqual(response.json(), {"error": {"code": "method_not_allowed"}})
        self.assertEqual(response["Allow"], "GET, HEAD, OPTIONS")


class _FakeServiceQuerySet:
    def __init__(self, rows):
        self.rows = rows

    def order_by(self, *fields):
        return self

    def filter(self, *args, **kwargs):
        query = args[0]
        cursor_name = next(value for key, value in query.children if key == "name__gt")
        same_name = next(child for child in query.children if hasattr(child, "children"))
        cursor_pk = next(value for key, value in same_name.children if key == "pk__gt")
        return type(self)([
            row for row in self.rows
            if row["name"] > cursor_name or (row["name"] == cursor_name and row["pk"] > cursor_pk)
        ])

    def values(self, *fields):
        return self.rows


class ServiceApiTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            email="services-api@example.com", password="correct-horse-battery-staple"
        )
        self.workspace = Workspace.objects.create(name="Service Studio", slug="service-studio")
        self.membership = Membership.objects.create(
            workspace=self.workspace, user=self.user, role=Membership.Role.OWNER
        )

    def authenticate(self, *, expires_at=1_000_100, workspace=None):
        self.client.force_login(self.user)
        session = self.client.session
        session["api.auth_expires_at"] = expires_at
        if workspace is not None:
            session["workspaces.active_workspace_public_id"] = str(workspace.public_id)
        session.save()

    def make_service(self, name, *, workspace=None, status=Service.Status.ACTIVE, archived_at=None):
        return Service.objects.create(
            workspace=workspace or self.workspace,
            name=name,
            description=f"Description for {name}",
            unit_of_measure=Service.UnitOfMeasure.HOUR,
            rate="125.50",
            currency=Service.Currency.USD,
            status=status,
            archived_at=archived_at,
        )

    @patch("api.auth_views.time.time", return_value=1_000_000)
    def test_requires_auth_deadline_and_active_membership_context(self, mocked_time):
        self.assertEqual(self.client.get("/api/v1/services/").status_code, 401)
        self.authenticate(expires_at=999_999, workspace=self.workspace)
        self.assertEqual(self.client.get("/api/v1/services/").status_code, 401)
        self.authenticate()
        self.assertEqual(self.client.get("/api/v1/services/").json(), {"error": {"code": "workspace_required"}})
        foreign = Workspace.objects.create(name="Foreign", slug="foreign-service-api")
        self.authenticate(workspace=foreign)
        self.assertEqual(self.client.get("/api/v1/services/").json(), {"error": {"code": "workspace_required"}})
        self.authenticate(workspace=self.workspace)
        with allow_membership_writes():
            self.membership.delete()
        self.assertEqual(self.client.get("/api/v1/services/").json(), {"error": {"code": "workspace_required"}})
        self.user.is_superuser = True
        self.user.save(update_fields=["is_superuser"])
        self.authenticate(workspace=self.workspace)
        self.assertEqual(self.client.get("/api/v1/services/").json(), {"error": {"code": "workspace_required"}})

    @patch("api.auth_views.time.time", return_value=1_000_000)
    def test_only_owner_and_operational_roles_may_read(self, mocked_time):
        self.authenticate(workspace=self.workspace)
        for role, expected in ((Membership.Role.ADMINISTRATIVE, 403), (Membership.Role.OPERATIONAL, 200), (Membership.Role.OWNER, 200)):
            with allow_membership_writes():
                Membership.objects.filter(pk=self.membership.pk).update(role=role)
            self.assertEqual(self.client.get("/api/v1/services/").status_code, expected)

    @patch("api.auth_views.time.time", return_value=1_000_000)
    def test_projects_strict_service_projection_and_no_store(self, mocked_time):
        self.authenticate(workspace=self.workspace)
        archived = self.make_service("Archived Service", status=Service.Status.ARCHIVED, archived_at=timezone.now())
        self.make_service("Active Service")
        foreign = Workspace.objects.create(name="Foreign", slug="foreign-service-list")
        self.make_service("Foreign Service", workspace=foreign)
        before = list(Service.objects.values_list("pk", "name", "status"))
        response = self.client.get("/api/v1/services/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Cache-Control"], "no-store")
        items = response.json()["data"]["items"]
        self.assertEqual([item["name"] for item in items], ["Active Service", "Archived Service"])
        self.assertEqual(set(items[0]), {"public_id", "name", "description", "unit_of_measure", "rate", "currency", "status", "archived_at"})
        self.assertEqual(items[1]["public_id"], str(archived.public_id))
        self.assertEqual(response.json()["data"]["next_cursor"], None)
        self.assertNotIn("workspace", items[0])
        self.assertEqual(list(Service.objects.values_list("pk", "name", "status")), before)

    @patch("api.auth_views.time.time", return_value=1_000_000)
    @patch("api.service_views.current_time", return_value=1_000_000)
    def test_cursor_pages_twenty_five_and_binds_session(self, mocked_cursor_time, mocked_auth_time):
        self.authenticate(workspace=self.workspace)
        for index in range(26, 0, -1):
            self.make_service(f"Service {index:02d}")
        first = self.client.get("/api/v1/services/")
        first_items = first.json()["data"]["items"]
        second = self.client.get("/api/v1/services/?cursor=" + first.json()["data"]["next_cursor"])
        second_items = second.json()["data"]["items"]
        self.assertEqual(len(first_items), 25)
        self.assertEqual(len(second_items), 1)
        self.assertEqual(len({item["public_id"] for item in first_items + second_items}), 26)
        self.assertIsNone(second.json()["data"]["next_cursor"])
        cursor = first.json()["data"]["next_cursor"]
        self.assertEqual(self.client.get(f"/api/v1/services/?cursor={cursor}x").status_code, 400)
        mocked_cursor_time.return_value = 1_000_101
        self.assertEqual(self.client.get(f"/api/v1/services/?cursor={cursor}").status_code, 400)
        mocked_auth_time.return_value = 1_000_000
        foreign = Workspace.objects.create(name="Other", slug="other-service-api")
        Membership.objects.create(workspace=foreign, user=self.user, role=Membership.Role.OWNER)
        self.authenticate(workspace=foreign)
        self.assertEqual(self.client.get(f"/api/v1/services/?cursor={cursor}").status_code, 400)

    @patch("api.auth_views.time.time", return_value=1_000_000)
    @patch("api.service_views.current_time", return_value=1_000_000)
    def test_keyset_tie_breaker_pages_duplicate_names_without_misses(self, mocked_cursor_time, mocked_auth_time):
        self.authenticate(workspace=self.workspace)
        rows = [
            {
                "public_id": uuid4(), "name": "Same Name", "description": "Description",
                "unit_of_measure": "HOUR", "rate": "125.50", "currency": "USD",
                "status": "ACTIVE", "archived_at": None, "pk": index,
            }
            for index in range(1, 27)
        ]
        fake = _FakeServiceQuerySet(rows)
        with patch("api.service_views.Service.objects.for_workspace", return_value=fake):
            first = self.client.get("/api/v1/services/")
            second = self.client.get("/api/v1/services/?cursor=" + first.json()["data"]["next_cursor"])
        first_ids = [item["public_id"] for item in first.json()["data"]["items"]]
        second_ids = [item["public_id"] for item in second.json()["data"]["items"]]
        self.assertEqual(len(first_ids), 25)
        self.assertEqual(second_ids, [str(rows[-1]["public_id"])])
        self.assertEqual(len(set(first_ids + second_ids)), 26)

    @patch("api.auth_views.time.time", return_value=1_000_000)
    @patch("api.service_views.current_time", return_value=1_000_000)
    def test_cursor_rejects_tampered_and_wrong_subject_workspace_membership_or_deadline(self, mocked_cursor_time, mocked_auth_time):
        from api.service_views import CURSOR_SESSION_KEY, CURSOR_SIGNER

        self.authenticate(workspace=self.workspace)
        for index in range(26):
            self.make_service(f"Service {index:02d}")
        cursor = self.client.get("/api/v1/services/").json()["data"]["next_cursor"]
        nonce = CURSOR_SIGNER.unsign(cursor).split(".", 1)[1]
        for field, value in (("subject", "foreign"), ("workspace", str(uuid4())), ("membership", 999), ("deadline", 999)):
            session = self.client.session
            session[CURSOR_SESSION_KEY][nonce][field] = value
            session.save()
            response = self.client.get(f"/api/v1/services/?cursor={cursor}")
            self.assertEqual(response.status_code, 400)
            self.assertEqual(response.json(), {"error": {"code": "invalid_request"}})
            session = self.client.session
            session[CURSOR_SESSION_KEY][nonce][field] = {"subject": str(self.user.pk), "workspace": str(self.workspace.public_id), "membership": self.membership.pk, "deadline": 1_000_100}[field]
            session.save()
        self.assertEqual(self.client.get(f"/api/v1/services/?cursor={cursor}x").status_code, 400)
        mocked_cursor_time.return_value = 1_000_101
        self.assertEqual(self.client.get(f"/api/v1/services/?cursor={cursor}").status_code, 400)

    @patch("api.auth_views.time.time", return_value=1_000_000)
    def test_query_allowlist_and_methods_are_json(self, mocked_time):
        self.authenticate(workspace=self.workspace)
        for path in ("/api/v1/services/?workspace=ignored", "/api/v1/services/?cursor=a&cursor=b"):
            response = self.client.get(path)
            self.assertEqual(response.status_code, 400)
            self.assertEqual(response.json(), {"error": {"code": "invalid_request"}})
        response = self.client.post("/api/v1/services/")
        self.assertEqual(response.status_code, 405)
        self.assertEqual(response.json(), {"error": {"code": "method_not_allowed"}})
        self.assertEqual(response["Allow"], "GET, HEAD, OPTIONS")


class ServiceCursorStorageTests(TestCase):
    @patch("api.service_views.current_time", return_value=100)
    def test_cursor_store_prunes_expired_records_and_caps_live_entries(self, mocked_time):
        from api.service_views import AUTH_EXPIRY_SESSION_KEY, CURSOR_MAX_ENTRIES, CURSOR_SESSION_KEY, _new_cursor

        request = SimpleNamespace(user=SimpleNamespace(pk=7), session={AUTH_EXPIRY_SESSION_KEY: 1_000})
        context = SimpleNamespace(workspace=SimpleNamespace(public_id="workspace"), membership=SimpleNamespace(pk=3))
        request.session[CURSOR_SESSION_KEY] = {
            "expired": {"deadline": 99},
            **{str(index): {"deadline": 1_000} for index in range(CURSOR_MAX_ENTRIES)},
        }
        _new_cursor(request, context, {"name": "Service", "pk": 999})
        cursors = request.session[CURSOR_SESSION_KEY]
        self.assertEqual(len(cursors), CURSOR_MAX_ENTRIES)
        self.assertNotIn("expired", cursors)
        self.assertNotIn("0", cursors)


class ProposalApiTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            email="proposals-api@example.com", password="correct-horse-battery-staple"
        )
        self.workspace = Workspace.objects.create(name="Proposal Studio", slug="proposal-studio")
        self.membership = Membership.objects.create(
            workspace=self.workspace, user=self.user, role=Membership.Role.OWNER
        )
        self.client_record = ClientModel.objects.create(
            workspace=self.workspace, legal_name="Acme Legal", client_type="COMPANY",
            tax_identifier="1234567890", primary_contact_name="Ada Lovelace",
            primary_contact_email="ada@example.com",
        )

    def authenticate(self, *, expires_at=1_000_100, workspace=None):
        self.client.force_login(self.user)
        session = self.client.session
        session["api.auth_expires_at"] = expires_at
        if workspace is not None:
            session["workspaces.active_workspace_public_id"] = str(workspace.public_id)
        session.save()

    def make_proposal(self, title, *, workspace=None, client=None, status=Proposal.Status.DRAFT, archived_at=None):
        sent_at = timezone.now() if status != Proposal.Status.DRAFT else None
        rejected_at = timezone.now() if status == Proposal.Status.REJECTED else None
        return Proposal.objects.create(
            workspace=workspace or self.workspace, client=client or self.client_record,
            title=title, notes="private", issued_on="2026-01-01", valid_until="2026-12-31",
            status=status, sent_at=sent_at, rejected_at=rejected_at, archived_at=archived_at,
        )

    @patch("api.auth_views.time.time", return_value=1_000_000)
    def test_requires_auth_deadline_context_and_fresh_owner_or_operational_membership(self, mocked_time):
        self.assertEqual(self.client.get("/api/v1/proposals/").status_code, 401)
        self.authenticate(expires_at=999_999, workspace=self.workspace)
        self.assertEqual(self.client.get("/api/v1/proposals/").status_code, 401)
        self.authenticate()
        self.assertEqual(self.client.get("/api/v1/proposals/").json(), {"error": {"code": "workspace_required"}})
        self.authenticate(workspace=self.workspace)
        self.membership.role = Membership.Role.ADMINISTRATIVE
        with allow_membership_writes():
            self.membership.save(update_fields=["role"])
        self.assertEqual(self.client.get("/api/v1/proposals/").status_code, 403)
        self.membership.role = Membership.Role.OPERATIONAL
        with allow_membership_writes():
            self.membership.save(update_fields=["role"])
        self.assertEqual(self.client.get("/api/v1/proposals/").status_code, 200)

    @patch("api.auth_views.time.time", return_value=1_000_000)
    def test_projection_tenant_archived_no_store_and_no_business_writes(self, mocked_time):
        self.authenticate(workspace=self.workspace)
        archived = self.make_proposal("Archived", status=Proposal.Status.REJECTED, archived_at=timezone.now())
        self.make_proposal("Active")
        foreign_workspace = Workspace.objects.create(name="Foreign Proposal", slug="foreign-proposal")
        foreign_client = ClientModel.objects.create(
            workspace=foreign_workspace, legal_name="Foreign Legal", client_type="COMPANY",
            tax_identifier="9876543210", primary_contact_name="Grace Hopper",
            primary_contact_email="grace@example.com",
        )
        self.make_proposal("Foreign", workspace=foreign_workspace, client=foreign_client)
        before = list(Proposal.objects.values_list("pk", "title", "status"))
        response = self.client.get("/api/v1/proposals/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Cache-Control"], "no-store")
        items = response.json()["data"]["items"]
        self.assertEqual([item["title"] for item in items], ["Active", "Archived"])
        self.assertEqual(set(items[0]), {"public_id", "client_public_id", "client_legal_name", "title", "issued_on", "valid_until", "status", "archived_at"})
        self.assertEqual(items[1]["public_id"], str(archived.public_id))
        self.assertEqual(items[0]["client_public_id"], str(self.client_record.public_id))
        self.assertEqual(list(Proposal.objects.values_list("pk", "title", "status")), before)

    @patch("api.auth_views.time.time", return_value=1_000_000)
    @patch("api.proposal_views.current_time", return_value=1_000_000)
    def test_pages_twenty_five_keyset_ties_and_cursor_bindings(self, mocked_cursor_time, mocked_auth_time):
        self.authenticate(workspace=self.workspace)
        for index in range(26):
            self.make_proposal("Same title")
        first = self.client.get("/api/v1/proposals/")
        cursor = first.json()["data"]["next_cursor"]
        second = self.client.get(f"/api/v1/proposals/?cursor={cursor}")
        self.assertEqual(len(first.json()["data"]["items"]), 25)
        self.assertEqual(len(second.json()["data"]["items"]), 1)
        self.assertEqual(len({x["public_id"] for x in first.json()["data"]["items"] + second.json()["data"]["items"]}), 26)
        self.assertEqual(self.client.get(f"/api/v1/proposals/?cursor={cursor}x").status_code, 400)
        mocked_cursor_time.return_value = 1_000_101
        self.assertEqual(self.client.get(f"/api/v1/proposals/?cursor={cursor}").status_code, 400)

    @patch("api.auth_views.time.time", return_value=1_000_000)
    @patch("api.proposal_views.current_time", return_value=1_000_000)
    def test_cursor_rejects_wrong_subject_workspace_membership_or_deadline(self, mocked_cursor_time, mocked_auth_time):
        from api.proposal_views import CURSOR_SESSION_KEY, CURSOR_SIGNER

        self.authenticate(workspace=self.workspace)
        for index in range(26):
            self.make_proposal(f"Proposal {index:02d}")
        cursor = self.client.get("/api/v1/proposals/").json()["data"]["next_cursor"]
        nonce = CURSOR_SIGNER.unsign(cursor).split(".", 1)[1]
        original = {"subject": str(self.user.pk), "workspace": str(self.workspace.public_id), "membership": self.membership.pk, "deadline": 1_000_100}
        for field, value in (("subject", "foreign"), ("workspace", str(uuid4())), ("membership", 999), ("deadline", 999)):
            session = self.client.session
            session[CURSOR_SESSION_KEY][nonce][field] = value
            session.save()
            self.assertEqual(self.client.get(f"/api/v1/proposals/?cursor={cursor}").status_code, 400)
            session = self.client.session
            session[CURSOR_SESSION_KEY][nonce][field] = original[field]
            session.save()

    @patch("api.auth_views.time.time", return_value=1_000_000)
    def test_query_allowlist_and_methods_are_json(self, mocked_time):
        self.authenticate(workspace=self.workspace)
        for path in ("/api/v1/proposals/?workspace=ignored", "/api/v1/proposals/?cursor=a&cursor=b"):
            response = self.client.get(path)
            self.assertEqual(response.status_code, 400)
            self.assertEqual(response.json(), {"error": {"code": "invalid_request"}})
        response = self.client.post("/api/v1/proposals/")
        self.assertEqual(response.status_code, 405)
        self.assertEqual(response.json(), {"error": {"code": "method_not_allowed"}})
        self.assertEqual(response["Allow"], "GET, HEAD, OPTIONS")


class ProposalCursorStorageTests(TestCase):
    @patch("api.proposal_views.current_time", return_value=100)
    def test_cursor_store_prunes_expired_records_and_caps_live_entries(self, mocked_time):
        from api.proposal_views import AUTH_EXPIRY_SESSION_KEY, CURSOR_MAX_ENTRIES, CURSOR_SESSION_KEY, _new_cursor

        request = SimpleNamespace(user=SimpleNamespace(pk=7), session={AUTH_EXPIRY_SESSION_KEY: 1_000})
        context = SimpleNamespace(workspace=SimpleNamespace(public_id="workspace"), membership=SimpleNamespace(pk=3))
        request.session[CURSOR_SESSION_KEY] = {"expired": {"deadline": 99}, **{str(index): {"deadline": 1_000} for index in range(CURSOR_MAX_ENTRIES)}}
        _new_cursor(request, context, {"title": "Proposal", "pk": 999})
        cursors = request.session[CURSOR_SESSION_KEY]
        self.assertEqual(len(cursors), CURSOR_MAX_ENTRIES)
        self.assertNotIn("expired", cursors)
        self.assertNotIn("0", cursors)


class ProjectApiTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            email="projects-api@example.com", password="correct-horse-battery-staple"
        )
        self.workspace = Workspace.objects.create(name="Project Studio", slug="project-studio")
        self.membership = Membership.objects.create(
            workspace=self.workspace, user=self.user, role=Membership.Role.OWNER
        )
        self.client_record = ClientModel.objects.create(
            workspace=self.workspace, legal_name="Project Client", client_type="COMPANY",
            tax_identifier="PROJECT-1", primary_contact_name="Ada Lovelace",
            primary_contact_email="ada@example.com",
        )
        self.context = ActiveWorkspaceContext(workspace=self.workspace, membership=self.membership)

    def authenticate(self, *, expires_at=1_000_100, workspace=None):
        self.client.force_login(self.user)
        session = self.client.session
        session["api.auth_expires_at"] = expires_at
        if workspace is not None:
            session["workspaces.active_workspace_public_id"] = str(workspace.public_id)
        session.save()

    def make_project(self, title, *, context=None, client=None):
        context = context or self.context
        client = client or self.client_record
        proposal = create_proposal(context, client, title, date.today(), date.today())
        add_line_item(
            context, proposal, position=1, service_name="Manual", unit_of_measure="HOUR",
            quantity=Decimal("1"), unit_rate=Decimal("10"),
        )
        proposal = send_proposal(context, proposal)
        proposal = transition_proposal(context, proposal, Proposal.Status.ACCEPTED)
        return convert_accepted_proposal(context, proposal)

    @patch("api.auth_views.time.time", return_value=1_000_000)
    def test_requires_auth_deadline_context_and_fresh_membership(self, mocked_time):
        self.assertEqual(self.client.get("/api/v1/projects/").status_code, 401)
        self.authenticate(expires_at=999_999, workspace=self.workspace)
        self.assertEqual(self.client.get("/api/v1/projects/").status_code, 401)
        self.authenticate()
        self.assertEqual(self.client.get("/api/v1/projects/").json(), {"error": {"code": "workspace_required"}})
        foreign = Workspace.objects.create(name="Foreign", slug="foreign-project-api")
        self.authenticate(workspace=foreign)
        self.assertEqual(self.client.get("/api/v1/projects/").json(), {"error": {"code": "workspace_required"}})
        self.authenticate(workspace=self.workspace)
        with allow_membership_writes():
            self.membership.delete()
        self.assertEqual(self.client.get("/api/v1/projects/").status_code, 400)
        self.user.is_superuser = True
        self.user.save(update_fields=["is_superuser"])
        self.authenticate(workspace=self.workspace)
        self.assertEqual(self.client.get("/api/v1/projects/").json(), {"error": {"code": "workspace_required"}})

    @patch("api.auth_views.time.time", return_value=1_000_000)
    def test_only_owner_and_operational_roles_may_read(self, mocked_time):
        self.authenticate(workspace=self.workspace)
        for role, expected in ((Membership.Role.ADMINISTRATIVE, 403), (Membership.Role.OPERATIONAL, 200), (Membership.Role.OWNER, 200)):
            with allow_membership_writes():
                Membership.objects.filter(pk=self.membership.pk).update(role=role)
            self.assertEqual(self.client.get("/api/v1/projects/").status_code, expected)

    @patch("api.auth_views.time.time", return_value=1_000_000)
    def test_projection_tenant_archived_no_store_and_no_business_writes(self, mocked_time):
        active = self.make_project("Active Project")
        completed = transition_project(self.context, self.make_project("Completed Project"), Project.Status.COMPLETED)
        archived = archive_project(self.context, completed)
        foreign_workspace = Workspace.objects.create(name="Foreign Project", slug="foreign-project-list")
        foreign_membership = Membership.objects.create(workspace=foreign_workspace, user=self.user, role=Membership.Role.OWNER)
        foreign_client = ClientModel.objects.create(
            workspace=foreign_workspace, legal_name="Foreign Legal", client_type="COMPANY",
            tax_identifier="FOREIGN-1", primary_contact_name="Grace Hopper",
            primary_contact_email="grace@example.com",
        )
        self.make_project("Foreign Project", context=ActiveWorkspaceContext(foreign_workspace, foreign_membership), client=foreign_client)
        before = list(Project.objects.values_list("pk", "status", "archived_at"))
        self.authenticate(workspace=self.workspace)
        response = self.client.get("/api/v1/projects/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Cache-Control"], "no-store")
        items = response.json()["data"]["items"]
        self.assertEqual([item["proposal_title"] for item in items], ["Active Project", "Completed Project"])
        self.assertEqual(set(items[0]), {
            "public_id", "client_public_id", "client_legal_name", "proposal_public_id",
            "proposal_title", "status", "completed_at", "cancelled_at", "archived_at",
        })
        self.assertEqual(items[1]["public_id"], str(archived.public_id))
        self.assertEqual(items[0]["public_id"], str(active.public_id))
        self.assertEqual(list(Project.objects.values_list("pk", "status", "archived_at")), before)

    @patch("api.auth_views.time.time", return_value=1_000_000)
    @patch("api.project_views.current_time", return_value=1_000_000)
    def test_pages_twenty_five_with_duplicate_proposal_titles(self, mocked_cursor_time, mocked_auth_time):
        for _ in range(26):
            self.make_project("Same title")
        self.authenticate(workspace=self.workspace)
        first = self.client.get("/api/v1/projects/")
        cursor = first.json()["data"]["next_cursor"]
        second = self.client.get(f"/api/v1/projects/?cursor={cursor}")
        ids = [x["public_id"] for x in first.json()["data"]["items"] + second.json()["data"]["items"]]
        self.assertEqual(len(first.json()["data"]["items"]), 25)
        self.assertEqual(len(second.json()["data"]["items"]), 1)
        self.assertEqual(len(set(ids)), 26)
        self.assertIsNone(second.json()["data"]["next_cursor"])

    @patch("api.auth_views.time.time", return_value=1_000_000)
    @patch("api.project_views.current_time", return_value=1_000_000)
    def test_cursor_rejects_tampering_wrong_bindings_and_expiry(self, mocked_cursor_time, mocked_auth_time):
        from api.project_views import CURSOR_SESSION_KEY, CURSOR_SIGNER

        for index in range(26):
            self.make_project(f"Project {index:02d}")
        self.authenticate(workspace=self.workspace)
        cursor = self.client.get("/api/v1/projects/").json()["data"]["next_cursor"]
        nonce = CURSOR_SIGNER.unsign(cursor).split(".", 1)[1]
        original = {"subject": str(self.user.pk), "workspace": str(self.workspace.public_id), "membership": self.membership.pk, "deadline": 1_000_100}
        for field, value in (("subject", "foreign"), ("workspace", str(uuid4())), ("membership", 999), ("deadline", 999)):
            session = self.client.session
            session[CURSOR_SESSION_KEY][nonce][field] = value
            session.save()
            self.assertEqual(self.client.get(f"/api/v1/projects/?cursor={cursor}").status_code, 400)
            session = self.client.session
            session[CURSOR_SESSION_KEY][nonce][field] = original[field]
            session.save()
        self.assertEqual(self.client.get(f"/api/v1/projects/?cursor={cursor}x").status_code, 400)
        mocked_cursor_time.return_value = 1_000_101
        self.assertEqual(self.client.get(f"/api/v1/projects/?cursor={cursor}").status_code, 400)

    @patch("api.auth_views.time.time", return_value=1_000_000)
    def test_query_allowlist_and_methods_are_json(self, mocked_time):
        self.authenticate(workspace=self.workspace)
        for path in ("/api/v1/projects/?workspace=ignored", "/api/v1/projects/?cursor=a&cursor=b"):
            response = self.client.get(path)
            self.assertEqual(response.status_code, 400)
            self.assertEqual(response.json(), {"error": {"code": "invalid_request"}})
        response = self.client.post("/api/v1/projects/")
        self.assertEqual(response.status_code, 405)
        self.assertEqual(response.json(), {"error": {"code": "method_not_allowed"}})
        self.assertEqual(response["Allow"], "GET, HEAD, OPTIONS")


class ProjectCursorStorageTests(TestCase):
    @patch("api.project_views.current_time", return_value=100)
    def test_cursor_store_prunes_expired_records_and_caps_live_entries(self, mocked_time):
        from api.project_views import AUTH_EXPIRY_SESSION_KEY, CURSOR_MAX_ENTRIES, CURSOR_SESSION_KEY, _new_cursor

        request = SimpleNamespace(user=SimpleNamespace(pk=7), session={AUTH_EXPIRY_SESSION_KEY: 1_000})
        context = SimpleNamespace(workspace=SimpleNamespace(public_id="workspace"), membership=SimpleNamespace(pk=3))
        request.session[CURSOR_SESSION_KEY] = {"expired": {"deadline": 99}, **{str(index): {"deadline": 1_000} for index in range(CURSOR_MAX_ENTRIES)}}
        _new_cursor(request, context, {"proposal_title": "Project", "pk": 999})
        cursors = request.session[CURSOR_SESSION_KEY]
        self.assertEqual(len(cursors), CURSOR_MAX_ENTRIES)
        self.assertNotIn("expired", cursors)
        self.assertNotIn("0", cursors)


class InvoiceApiTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            email="invoices-api@example.com", password="correct-horse-battery-staple"
        )
        self.workspace = Workspace.objects.create(name="Invoice Studio", slug="invoice-studio")
        self.membership = Membership.objects.create(
            workspace=self.workspace, user=self.user, role=Membership.Role.OWNER
        )
        self.client_record = ClientModel.objects.create(
            workspace=self.workspace, legal_name="Invoice Client", client_type="COMPANY",
            tax_identifier="INV-1", primary_contact_name="Ada Lovelace",
            primary_contact_email="ada@example.com",
        )
        self.context = ActiveWorkspaceContext(self.workspace, self.membership)

    def authenticate(self, *, expires_at=1_000_100, workspace=None):
        self.client.force_login(self.user)
        session = self.client.session
        session["api.auth_expires_at"] = expires_at
        if workspace is not None:
            session["workspaces.active_workspace_public_id"] = str(workspace.public_id)
        session.save()

    def make_invoice(self, title, *, context=None, client=None):
        context = context or self.context
        client = client or self.client_record
        proposal = create_proposal(context, client, title, date.today(), date.today())
        add_line_item(
            context, proposal, position=1, service_name="Manual", unit_of_measure="HOUR",
            quantity=Decimal("1"), unit_rate=Decimal("10"),
        )
        proposal = send_proposal(context, proposal)
        proposal = transition_proposal(context, proposal, Proposal.Status.ACCEPTED)
        project = convert_accepted_proposal(context, proposal)
        return create_draft_invoice(context, project)

    @patch("api.auth_views.time.time", return_value=1_000_000)
    def test_requires_auth_deadline_context_and_fresh_owner_or_operational_membership(self, mocked_time):
        self.assertEqual(self.client.get("/api/v1/invoices/").status_code, 401)
        self.authenticate(expires_at=999_999, workspace=self.workspace)
        self.assertEqual(self.client.get("/api/v1/invoices/").status_code, 401)
        self.authenticate()
        self.assertEqual(self.client.get("/api/v1/invoices/").json(), {"error": {"code": "workspace_required"}})
        self.authenticate(workspace=self.workspace)
        with allow_membership_writes():
            self.membership.role = Membership.Role.ADMINISTRATIVE
            self.membership.save(update_fields=["role"])
        self.assertEqual(self.client.get("/api/v1/invoices/").status_code, 403)
        with allow_membership_writes():
            self.membership.role = Membership.Role.OPERATIONAL
            self.membership.save(update_fields=["role"])
        self.assertEqual(self.client.get("/api/v1/invoices/").status_code, 200)

    @patch("api.auth_views.time.time", return_value=1_000_000)
    def test_projection_is_tenant_scoped_strict_and_read_only(self, mocked_time):
        invoice = self.make_invoice("Visible Project")
        foreign_workspace = Workspace.objects.create(name="Foreign Invoice", slug="foreign-invoice")
        foreign_membership = Membership.objects.create(workspace=foreign_workspace, user=self.user, role=Membership.Role.OWNER)
        foreign_client = ClientModel.objects.create(
            workspace=foreign_workspace, legal_name="Foreign Legal", client_type="COMPANY",
            tax_identifier="FOREIGN-1", primary_contact_name="Grace Hopper",
            primary_contact_email="grace@example.com",
        )
        self.make_invoice("Foreign Project", context=ActiveWorkspaceContext(foreign_workspace, foreign_membership), client=foreign_client)
        before = list(Invoice.objects.values_list("pk", "status", "number"))
        self.authenticate(workspace=self.workspace)
        response = self.client.get("/api/v1/invoices/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Cache-Control"], "no-store")
        items = response.json()["data"]["items"]
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["public_id"], str(invoice.public_id))
        self.assertEqual(set(items[0]), {
            "public_id", "client_public_id", "client_legal_name", "project_public_id",
            "proposal_public_id", "proposal_title", "number", "status", "issued_at", "voided_at",
        })
        for forbidden in ("subtotal", "total", "fiscal_legal_name", "fiscal_tax_regime", "void_reason", "pk", "created_at", "updated_at"):
            self.assertNotIn(forbidden, items[0])
        self.assertEqual(list(Invoice.objects.values_list("pk", "status", "number")), before)

    @patch("api.auth_views.time.time", return_value=1_000_000)
    def test_issuing_invoices_are_hidden_but_draft_issued_and_void_are_listed(self, mocked_time):
        self.make_invoice("Draft")
        issued = self.make_invoice("Issued")
        void = self.make_invoice("Void")
        issuing = self.make_invoice("Issuing")
        fiscal = create_fiscal_configuration(
            self.context, legal_name="Invoice Studio", tax_identifier="INV-1",
            tax_regime="GENERAL", applies_vat=True, vat_rate=Decimal("15.00"),
            withholding_rate=Decimal("0.00"),
        )
        now = timezone.now()
        issued = issue_invoice(self.context, issued)
        void = void_invoice(self.context, issue_invoice(self.context, void), reason="test")
        with _invoice_service_write_boundary():
            Invoice.objects.filter(pk=issuing.pk).update(
                status=Invoice.Status.ISSUING, number="INV-000003",
                fiscal_configuration_id=fiscal.pk, fiscal_version=fiscal.version,
                fiscal_legal_name=fiscal.legal_name, fiscal_tax_identifier=fiscal.tax_identifier,
                fiscal_tax_regime=fiscal.tax_regime, fiscal_applies_vat=fiscal.applies_vat,
                fiscal_vat_rate=fiscal.vat_rate, fiscal_withholding_rate=fiscal.withholding_rate,
                issued_at=now,
            )
        self.authenticate(workspace=self.workspace)
        response = self.client.get("/api/v1/invoices/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual([item["proposal_title"] for item in response.json()["data"]["items"]], ["Draft", "Issued", "Void"])
        self.assertEqual({item["status"] for item in response.json()["data"]["items"]}, {Invoice.Status.DRAFT, Invoice.Status.ISSUED, Invoice.Status.VOID})

    @patch("api.auth_views.time.time", return_value=1_000_000)
    def test_query_allowlist_and_methods_are_json(self, mocked_time):
        self.authenticate(workspace=self.workspace)
        for path in ("/api/v1/invoices/?workspace=ignored", "/api/v1/invoices/?cursor=a&cursor=b"):
            response = self.client.get(path)
            self.assertEqual(response.status_code, 400)
            self.assertEqual(response.json(), {"error": {"code": "invalid_request"}})
        response = self.client.post("/api/v1/invoices/")
        self.assertEqual(response.status_code, 405)
        self.assertEqual(response.json(), {"error": {"code": "method_not_allowed"}})
        self.assertEqual(response["Allow"], "GET, HEAD, OPTIONS")

    @patch("api.auth_views.time.time", return_value=1_000_000)
    @patch("api.invoice_views.current_time", return_value=1_000_000)
    def test_pages_twenty_five_duplicate_titles_and_rejects_tampered_or_expired_cursor(self, mocked_cursor_time, mocked_auth_time):
        for _ in range(26):
            self.make_invoice("Same title")
        self.authenticate(workspace=self.workspace)
        first = self.client.get("/api/v1/invoices/")
        cursor = first.json()["data"]["next_cursor"]
        second = self.client.get(f"/api/v1/invoices/?cursor={cursor}")
        ids = [x["public_id"] for x in first.json()["data"]["items"] + second.json()["data"]["items"]]
        self.assertEqual(len(first.json()["data"]["items"]), 25)
        self.assertEqual(len(second.json()["data"]["items"]), 1)
        self.assertEqual(len(set(ids)), 26)
        self.assertEqual(self.client.get(f"/api/v1/invoices/?cursor={cursor}x").status_code, 400)
        mocked_cursor_time.return_value = 1_000_101
        self.assertEqual(self.client.get(f"/api/v1/invoices/?cursor={cursor}").status_code, 400)

    @patch("api.auth_views.time.time", return_value=1_000_000)
    def test_cursor_rejects_wrong_bindings(self, mocked_time):
        from api.invoice_views import CURSOR_SESSION_KEY, CURSOR_SIGNER

        for index in range(26):
            self.make_invoice(f"Invoice {index:02d}")
        self.authenticate(workspace=self.workspace)
        cursor = self.client.get("/api/v1/invoices/").json()["data"]["next_cursor"]
        nonce = CURSOR_SIGNER.unsign(cursor).split(".", 1)[1]
        original = {"subject": str(self.user.pk), "workspace": str(self.workspace.public_id), "membership": self.membership.pk, "deadline": 1_000_100}
        for field, value in (("subject", "foreign"), ("workspace", str(uuid4())), ("membership", 999), ("deadline", 999)):
            session = self.client.session
            session[CURSOR_SESSION_KEY][nonce][field] = value
            session.save()
            self.assertEqual(self.client.get(f"/api/v1/invoices/?cursor={cursor}").status_code, 400)
            session = self.client.session
            session[CURSOR_SESSION_KEY][nonce][field] = original[field]
            session.save()


class InvoiceCursorStorageTests(TestCase):
    @patch("api.invoice_views.current_time", return_value=100)
    def test_cursor_store_prunes_expired_records_and_caps_live_entries(self, mocked_time):
        from api.invoice_views import AUTH_EXPIRY_SESSION_KEY, CURSOR_MAX_ENTRIES, CURSOR_SESSION_KEY, _new_cursor

        request = SimpleNamespace(user=SimpleNamespace(pk=7), session={AUTH_EXPIRY_SESSION_KEY: 1_000})
        context = SimpleNamespace(workspace=SimpleNamespace(public_id="workspace"), membership=SimpleNamespace(pk=3))
        request.session[CURSOR_SESSION_KEY] = {"expired": {"deadline": 99}, **{str(index): {"deadline": 1_000} for index in range(CURSOR_MAX_ENTRIES)}}
        _new_cursor(request, context, {"proposal_title": "Invoice", "pk": 999})
        cursors = request.session[CURSOR_SESSION_KEY]
        self.assertEqual(len(cursors), CURSOR_MAX_ENTRIES)
        self.assertNotIn("expired", cursors)
        self.assertNotIn("0", cursors)


class PaymentApiTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            email="payments-api@example.com", password="correct-horse-battery-staple"
        )
        self.workspace = Workspace.objects.create(name="Payment Studio", slug="payment-studio")
        self.membership = Membership.objects.create(
            workspace=self.workspace, user=self.user, role=Membership.Role.OWNER
        )
        self.client_record = ClientModel.objects.create(
            workspace=self.workspace, legal_name="Payment Client", client_type="COMPANY",
            tax_identifier="PAY-1", primary_contact_name="Ada Lovelace",
            primary_contact_email="ada@example.com",
        )
        self.context = ActiveWorkspaceContext(self.workspace, self.membership)

    def authenticate(self, *, expires_at=1_000_100, workspace=None):
        self.client.force_login(self.user)
        session = self.client.session
        session["api.auth_expires_at"] = expires_at
        if workspace is not None:
            session["workspaces.active_workspace_public_id"] = str(workspace.public_id)
        session.save()

    def make_payment(self, *, received_at=None, context=None, client=None, amount=Decimal("10.00")):
        context = context or self.context
        client = client or self.client_record
        proposal = create_proposal(context, client, "Payment Project", date.today(), date.today())
        add_line_item(
            context, proposal, position=1, service_name="Manual", unit_of_measure="HOUR",
            quantity=Decimal("1"), unit_rate=Decimal("10"),
        )
        proposal = send_proposal(context, proposal)
        proposal = transition_proposal(context, proposal, Proposal.Status.ACCEPTED)
        project = convert_accepted_proposal(context, proposal)
        invoice = create_draft_invoice(context, project)
        create_fiscal_configuration(
            context, legal_name="Payment Studio", tax_identifier="PAY-1",
            tax_regime="GENERAL", applies_vat=False, vat_rate=Decimal("0.00"),
            withholding_rate=Decimal("0.00"),
        )
        invoice = issue_invoice(context, invoice)
        return record_payment(
            context, invoice, amount=amount, idempotency_key=uuid4(), source_type="BANK",
            source_reference="PAY-REF", received_at=received_at,
        )

    @patch("api.auth_views.time.time", return_value=1_000_000)
    def test_requires_auth_active_context_and_fresh_operational_membership(self, mocked_time):
        self.assertEqual(self.client.get("/api/v1/payments/").status_code, 401)
        self.authenticate(workspace=self.workspace, expires_at=999_999)
        self.assertEqual(self.client.get("/api/v1/payments/").status_code, 401)
        self.authenticate()
        self.assertEqual(self.client.get("/api/v1/payments/").json(), {"error": {"code": "workspace_required"}})
        self.authenticate(workspace=self.workspace)
        with allow_membership_writes():
            self.membership.role = Membership.Role.ADMINISTRATIVE
            self.membership.save(update_fields=["role"])
        self.assertEqual(self.client.get("/api/v1/payments/").status_code, 403)

    @patch("api.auth_views.time.time", return_value=1_000_000)
    def test_projection_is_tenant_scoped_and_includes_reversal_without_internal_fields(self, mocked_time):
        received_at = timezone.now()
        payment = self.make_payment(received_at=received_at)
        reverse_payment(
            self.context, payment.invoice, payment, idempotency_key=uuid4(), reason="Refund",
            reversed_at=received_at + timedelta(minutes=1),
        )
        self.authenticate(workspace=self.workspace)
        response = self.client.get("/api/v1/payments/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Cache-Control"], "no-store")
        item = response.json()["data"]["items"][0]
        self.assertEqual(set(item), {
            "public_id", "invoice_public_id", "invoice_number_snapshot", "amount", "received_at", "reversed_at",
        })
        self.assertEqual(item["public_id"], str(payment.public_id))
        self.assertEqual(item["invoice_public_id"], str(payment.invoice.public_id))
        for forbidden in ("currency", "pk", "idempotency_key", "fingerprint", "source_type", "source_reference", "created_by", "created_at", "invoice"):
            self.assertNotIn(forbidden, item)

    @patch("api.auth_views.time.time", return_value=1_000_000)
    def test_reversed_payment_serializes_reversed_at_exactly(self, mocked_time):
        received_at = datetime(2024, 1, 1, 12, tzinfo=datetime_timezone.utc)
        reversed_at = received_at + timedelta(minutes=1)
        payment = self.make_payment(received_at=received_at)
        reverse_payment(
            self.context, payment.invoice, payment, idempotency_key=uuid4(), reason="Refund",
            reversed_at=reversed_at,
        )
        self.authenticate(workspace=self.workspace)

        response = self.client.get("/api/v1/payments/")

        self.assertEqual(response.status_code, 200)
        item = response.json()["data"]["items"][0]
        self.assertIn("reversed_at", item)
        self.assertEqual(item["reversed_at"], reversed_at.isoformat().replace("+00:00", "Z"))

    @patch("api.auth_views.time.time", return_value=1_000_000)
    def test_unreversed_payment_returns_null_reversed_at_and_operational_role_is_allowed(self, mocked_time):
        payment = self.make_payment(received_at=datetime(2024, 1, 1, tzinfo=datetime_timezone.utc))
        self.authenticate(workspace=self.workspace)
        with allow_membership_writes():
            self.membership.role = Membership.Role.OPERATIONAL
            self.membership.save(update_fields=["role"])
        response = self.client.get("/api/v1/payments/")
        self.assertEqual(response.status_code, 200)
        item = response.json()["data"]["items"][0]
        self.assertEqual(item["public_id"], str(payment.public_id))
        self.assertIsNone(item["reversed_at"])

    @patch("api.auth_views.time.time", return_value=1_000_000)
    def test_directory_excludes_payments_from_other_workspaces(self, mocked_time):
        foreign_workspace = Workspace.objects.create(name="Foreign Payment Studio", slug="foreign-payment-studio")
        foreign_membership = Membership.objects.create(
            workspace=foreign_workspace, user=self.user, role=Membership.Role.OWNER
        )
        foreign_client = ClientModel.objects.create(
            workspace=foreign_workspace, legal_name="Foreign Payment Client", client_type="COMPANY",
            tax_identifier="FOREIGN-PAY-1", primary_contact_name="Grace Hopper",
            primary_contact_email="grace@example.com",
        )
        payment = self.make_payment(
            context=ActiveWorkspaceContext(foreign_workspace, foreign_membership),
            client=foreign_client,
        )
        self.authenticate(workspace=self.workspace)
        response = self.client.get("/api/v1/payments/")
        self.assertEqual(response.status_code, 200)
        self.assertNotIn(str(payment.public_id), {item["public_id"] for item in response.json()["data"]["items"]})

    @patch("api.auth_views.time.time", return_value=1_000_000)
    def test_query_allowlist_and_methods_are_json(self, mocked_time):
        self.authenticate(workspace=self.workspace)
        for path in ("/api/v1/payments/?workspace=ignored", "/api/v1/payments/?cursor=a&cursor=b"):
            response = self.client.get(path)
            self.assertEqual(response.status_code, 400)
            self.assertEqual(response.json(), {"error": {"code": "invalid_request"}})
        response = self.client.post("/api/v1/payments/")
        self.assertEqual(response.status_code, 405)
        self.assertEqual(response.json(), {"error": {"code": "method_not_allowed"}})
        self.assertEqual(response["Allow"], "GET, HEAD, OPTIONS")

    @patch("api.auth_views.time.time", return_value=1_000_000)
    @patch("api.payment_views.current_time", return_value=1_000_000)
    def test_cursor_pages_descending_received_at_and_rejects_tampering_or_expiry(self, mocked_cursor_time, mocked_auth_time):
        received_at = datetime(2024, 1, 1, tzinfo=datetime_timezone.utc)
        payments = [self.make_payment(received_at=received_at) for _ in range(26)]
        self.authenticate(workspace=self.workspace)
        first = self.client.get("/api/v1/payments/")
        cursor = first.json()["data"]["next_cursor"]
        second = self.client.get(f"/api/v1/payments/?cursor={cursor}")
        items = first.json()["data"]["items"] + second.json()["data"]["items"]
        self.assertEqual(len(first.json()["data"]["items"]), 25)
        self.assertEqual(len(second.json()["data"]["items"]), 1)
        self.assertEqual(len({item["public_id"] for item in items}), 26)
        self.assertEqual([item["public_id"] for item in items], [str(payment.public_id) for payment in reversed(payments)])
        self.assertEqual(self.client.get(f"/api/v1/payments/?cursor={cursor}x").status_code, 400)
        mocked_cursor_time.return_value = 1_000_101
        self.assertEqual(self.client.get(f"/api/v1/payments/?cursor={cursor}").status_code, 400)

    @patch("api.auth_views.time.time", return_value=1_000_000)
    @patch("api.payment_views.current_time", return_value=1_000_000)
    def test_cursor_cannot_be_reused_from_another_authenticated_session(self, mocked_cursor_time, mocked_auth_time):
        for _ in range(26):
            self.make_payment()
        self.authenticate(workspace=self.workspace)
        cursor = self.client.get("/api/v1/payments/").json()["data"]["next_cursor"]

        other_client = Client()
        other_client.force_login(self.user)
        session = other_client.session
        session["api.auth_expires_at"] = 1_000_100
        session["workspaces.active_workspace_public_id"] = str(self.workspace.public_id)
        session.save()

        response = other_client.get(f"/api/v1/payments/?cursor={cursor}")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"error": {"code": "invalid_request"}})
        self.assertNotIn("data", response.json())

    @patch("api.auth_views.time.time", return_value=1_000_000)
    def test_cursor_rejects_wrong_subject_workspace_membership_and_deadline_bindings(self, mocked_time):
        for _ in range(26):
            self.make_payment()
        self.authenticate(workspace=self.workspace)
        cursor = self.client.get("/api/v1/payments/").json()["data"]["next_cursor"]
        from api.payment_views import CURSOR_SESSION_KEY, CURSOR_SIGNER

        nonce = CURSOR_SIGNER.unsign(cursor).split(".", 1)[1]
        original = {
            "subject": str(self.user.pk), "workspace": str(self.workspace.public_id),
            "membership": self.membership.pk, "deadline": 1_000_100,
        }
        for field, value in (("subject", "foreign"), ("workspace", str(uuid4())), ("membership", 999), ("deadline", 999)):
            session = self.client.session
            session[CURSOR_SESSION_KEY][nonce][field] = value
            session.save()
            self.assertEqual(self.client.get(f"/api/v1/payments/?cursor={cursor}").status_code, 400)
            session = self.client.session
            session[CURSOR_SESSION_KEY][nonce][field] = original[field]
            session.save()


class PaymentCursorStorageTests(TestCase):
    @patch("api.payment_views.current_time", return_value=100)
    def test_cursor_store_prunes_expired_records_and_caps_live_entries(self, mocked_time):
        from api.payment_views import AUTH_EXPIRY_SESSION_KEY, CURSOR_MAX_ENTRIES, CURSOR_SESSION_KEY, _new_cursor

        request = SimpleNamespace(user=SimpleNamespace(pk=7), session={AUTH_EXPIRY_SESSION_KEY: 1_000})
        context = SimpleNamespace(workspace=SimpleNamespace(public_id="workspace"), membership=SimpleNamespace(pk=3))
        request.session[CURSOR_SESSION_KEY] = {"expired": {"deadline": 99}, **{str(index): {"deadline": 1_000} for index in range(CURSOR_MAX_ENTRIES)}}
        _new_cursor(request, context, {"received_at": datetime(2024, 1, 1, tzinfo=datetime_timezone.utc), "pk": 999})
        cursors = request.session[CURSOR_SESSION_KEY]
        self.assertEqual(len(cursors), CURSOR_MAX_ENTRIES)
        self.assertNotIn("expired", cursors)
        self.assertNotIn("0", cursors)


class CategoryApiTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            email="categories-api@example.com", password="correct-horse-battery-staple"
        )
        self.workspace = Workspace.objects.create(name="Category Studio", slug="category-api-studio")
        self.membership = Membership.objects.create(
            workspace=self.workspace, user=self.user, role=Membership.Role.OWNER
        )
        self.context = ActiveWorkspaceContext(self.workspace, self.membership)

    def authenticate(self, *, expires_at=1_000_100, workspace=None):
        self.client.force_login(self.user)
        session = self.client.session
        session["api.auth_expires_at"] = expires_at
        if workspace is not None:
            session["workspaces.active_workspace_public_id"] = str(workspace.public_id)
        session.save()

    def make_category(self, name, *, context=None, status=Category.Status.ACTIVE, monthly_budget=Decimal("12.50")):
        return create_category(
            context or self.context, name=name, description=f"Description for {name}",
            default_deductible=True, monthly_budget=monthly_budget, status=status,
        )

    @patch("api.auth_views.time.time", return_value=1_000_000)
    def test_requires_live_session_and_current_active_membership_context(self, mocked_time):
        self.assertEqual(self.client.get("/api/v1/categories/").status_code, 401)
        self.authenticate(expires_at=999_999, workspace=self.workspace)
        self.assertEqual(self.client.get("/api/v1/categories/").status_code, 401)
        self.authenticate()
        self.assertEqual(self.client.get("/api/v1/categories/").json(), {"error": {"code": "workspace_required"}})
        foreign = Workspace.objects.create(name="Foreign Category", slug="foreign-category-api")
        self.authenticate(workspace=foreign)
        self.assertEqual(self.client.get("/api/v1/categories/").json(), {"error": {"code": "workspace_required"}})
        self.authenticate(workspace=self.workspace)
        with allow_membership_writes():
            self.membership.delete()
        self.assertEqual(self.client.get("/api/v1/categories/").json(), {"error": {"code": "workspace_required"}})

    @patch("api.auth_views.time.time", return_value=1_000_000)
    def test_only_owner_and_operational_roles_may_read(self, mocked_time):
        self.authenticate(workspace=self.workspace)
        for role, expected in ((Membership.Role.ADMINISTRATIVE, 403), (Membership.Role.OPERATIONAL, 200), (Membership.Role.OWNER, 200)):
            with allow_membership_writes():
                Membership.objects.filter(pk=self.membership.pk).update(role=role)
            self.assertEqual(self.client.get("/api/v1/categories/").status_code, expected)

    @patch("api.auth_views.time.time", return_value=1_000_000)
    def test_projection_is_ordered_tenant_scoped_and_does_not_write(self, mocked_time):
        self.make_category("Zeta", monthly_budget=None)
        first = self.make_category("Alpha", monthly_budget=Decimal("125.50"))
        foreign_workspace = Workspace.objects.create(name="Foreign Category", slug="foreign-category-list")
        foreign_membership = Membership.objects.create(workspace=foreign_workspace, user=self.user, role=Membership.Role.OWNER)
        foreign = self.make_category("Foreign", context=ActiveWorkspaceContext(foreign_workspace, foreign_membership))
        before = list(Category.objects.values_list("pk", "name", "status", "monthly_budget"))
        self.authenticate(workspace=self.workspace)

        response = self.client.get("/api/v1/categories/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Cache-Control"], "no-store")
        items = response.json()["data"]["items"]
        self.assertEqual([item["name"] for item in items], ["Alpha", "Zeta"])
        self.assertEqual(items[0]["public_id"], str(first.public_id))
        self.assertNotIn(str(foreign.public_id), {item["public_id"] for item in items})
        self.assertEqual(set(items[0]), {"public_id", "name", "description", "default_deductible", "monthly_budget", "status"})
        self.assertEqual(items[0]["monthly_budget"], "125.50")
        self.assertIsNone(items[1]["monthly_budget"])
        self.assertEqual(list(Category.objects.values_list("pk", "name", "status", "monthly_budget")), before)

    @patch("api.auth_views.time.time", return_value=1_000_000)
    def test_selectable_only_exact_values_follow_domain_filter(self, mocked_time):
        active = self.make_category("Active")
        inactive = self.make_category("Inactive", status=Category.Status.INACTIVE)
        self.authenticate(workspace=self.workspace)

        default = self.client.get("/api/v1/categories/")
        unfiltered = self.client.get("/api/v1/categories/?selectable_only=false")
        selectable = self.client.get("/api/v1/categories/?selectable_only=true")

        self.assertEqual({item["public_id"] for item in default.json()["data"]["items"]}, {str(active.public_id), str(inactive.public_id)})
        self.assertEqual({item["public_id"] for item in unfiltered.json()["data"]["items"]}, {str(active.public_id), str(inactive.public_id)})
        self.assertEqual(selectable.json()["data"]["items"], [
            {"public_id": str(active.public_id), "name": "Active", "description": "Description for Active", "default_deductible": True, "monthly_budget": "12.50", "status": "ACTIVE"}
        ])

    @patch("api.auth_views.time.time", return_value=1_000_000)
    def test_rejects_invalid_query_contract_and_non_get_methods_as_json(self, mocked_time):
        self.authenticate(workspace=self.workspace)
        for path in (
            "/api/v1/categories/?workspace=ignored",
            "/api/v1/categories/?selectable_only=yes",
            "/api/v1/categories/?selectable_only=true&selectable_only=false",
            "/api/v1/categories/?selectable_only=true&extra=value",
        ):
            response = self.client.get(path)
            self.assertEqual(response.status_code, 400)
            self.assertEqual(response.json(), {"error": {"code": "invalid_request"}})
        response = self.client.post("/api/v1/categories/")
        self.assertEqual(response.status_code, 405)
        self.assertEqual(response.json(), {"error": {"code": "method_not_allowed"}})
        self.assertEqual(response["Allow"], "GET, HEAD, OPTIONS")


class LedgerEntryApiTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            email="ledger-api@example.com", password="correct-horse-battery-staple"
        )
        self.other_user = get_user_model().objects.create_user(
            email="ledger-other-api@example.com", password="correct-horse-battery-staple"
        )
        self.workspace = Workspace.objects.create(name="Ledger API Studio", slug="ledger-api-studio")
        self.membership = Membership.objects.create(
            workspace=self.workspace, user=self.user, role=Membership.Role.OWNER
        )
        self.context = ActiveWorkspaceContext(self.workspace, self.membership)
        self.category = create_category(
            self.context, name="Travel", description="Travel expenses",
            default_deductible=True, monthly_budget=Decimal("50.00"), status=Category.Status.ACTIVE,
        )

    def authenticate(self, *, expires_at=1_000_100, workspace=None, user=None):
        self.client.force_login(user or self.user)
        session = self.client.session
        session["api.auth_expires_at"] = expires_at
        if workspace is not None:
            session["workspaces.active_workspace_public_id"] = str(workspace.public_id)
        session.save()

    def make_entry(self, *, occurred_on=date(2024, 1, 1), context=None, category=None, client=None, project=None):
        from ledger.models import LedgerEntry
        from ledger.services import record_manual_entry

        return record_manual_entry(
            context or self.context, idempotency_key=uuid4(), direction=LedgerEntry.Direction.EXPENSE,
            amount=Decimal("12.50"), occurred_on=occurred_on, description="Taxi ride",
            category=category or self.category, client=client, project=project,
        )

    @patch("api.auth_views.time.time", return_value=1_000_000)
    def test_requires_live_session_fresh_context_and_operational_membership(self, mocked_time):
        self.assertEqual(self.client.get("/api/v1/ledger-entries/").status_code, 401)
        self.authenticate(expires_at=999_999, workspace=self.workspace)
        self.assertEqual(self.client.get("/api/v1/ledger-entries/").status_code, 401)
        self.authenticate()
        self.assertEqual(self.client.get("/api/v1/ledger-entries/").json(), {"error": {"code": "workspace_required"}})
        self.authenticate(workspace=self.workspace)
        with allow_membership_writes():
            Membership.objects.filter(pk=self.membership.pk).update(role=Membership.Role.ADMINISTRATIVE)
        self.assertEqual(self.client.get("/api/v1/ledger-entries/").status_code, 403)
        with allow_membership_writes():
            Membership.objects.filter(pk=self.membership.pk).update(role=Membership.Role.OPERATIONAL)
        self.assertEqual(self.client.get("/api/v1/ledger-entries/").status_code, 200)
        with allow_membership_writes():
            self.membership.delete()
        self.assertEqual(self.client.get("/api/v1/ledger-entries/").json(), {"error": {"code": "workspace_required"}})

    @patch("api.auth_views.time.time", return_value=1_000_000)
    def test_superuser_without_membership_cannot_read_foreign_or_unknown_workspace(self, mocked_time):
        superuser = get_user_model().objects.create_superuser(
            email="ledger-superuser-api@example.com", password="correct-horse-battery-staple"
        )
        self.client.force_login(superuser)
        for workspace_public_id in (str(self.workspace.public_id), str(uuid4())):
            session = self.client.session
            session["api.auth_expires_at"] = 1_000_100
            session["workspaces.active_workspace_public_id"] = workspace_public_id
            session.save()

            response = self.client.get("/api/v1/ledger-entries/")

            self.assertEqual(response.status_code, 400)
            self.assertEqual(response.json(), {"error": {"code": "workspace_required"}})

    @patch("api.auth_views.time.time", return_value=1_000_000)
    def test_returns_exact_public_projection_tenant_scoped_and_without_database_writes(self, mocked_time):
        client = ClientModel.objects.create(
            workspace=self.workspace, legal_name="Ledger Client", client_type="COMPANY",
            tax_identifier="LEDGER-CLIENT", primary_contact_name="Ada Lovelace",
            primary_contact_email="ada@example.com",
        )
        entry = self.make_entry(client=client)
        foreign_workspace = Workspace.objects.create(name="Foreign Ledger", slug="foreign-ledger-api")
        foreign_membership = Membership.objects.create(
            workspace=foreign_workspace, user=self.other_user, role=Membership.Role.OWNER
        )
        foreign_category = create_category(
            ActiveWorkspaceContext(foreign_workspace, foreign_membership), name="Foreign", description="Foreign",
            default_deductible=False, monthly_budget=None, status=Category.Status.ACTIVE,
        )
        foreign_entry = self.make_entry(
            context=ActiveWorkspaceContext(foreign_workspace, foreign_membership), category=foreign_category,
        )
        from ledger.models import LedgerEntry
        before = list(LedgerEntry.objects.values_list("pk", "public_id", "created_at"))
        self.authenticate(workspace=self.workspace)

        response = self.client.get("/api/v1/ledger-entries/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Cache-Control"], "no-store")
        item = response.json()["data"]["items"][0]
        self.assertEqual(set(item), {
            "public_id", "direction", "source", "amount", "currency", "occurred_on", "description",
            "category_name_snapshot", "category_deductible_snapshot", "client_public_id", "project_public_id", "created_at",
        })
        self.assertEqual(item["public_id"], str(entry.public_id))
        self.assertEqual(item["amount"], "12.50")
        self.assertEqual(item["currency"], "USD")
        self.assertEqual(item["direction"], "EXPENSE")
        self.assertEqual(item["source"], "MANUAL")
        self.assertEqual(item["description"], "Taxi ride")
        self.assertEqual(item["category_name_snapshot"], "Travel")
        self.assertIs(item["category_deductible_snapshot"], True)
        self.assertEqual(item["occurred_on"], "2024-01-01")
        self.assertEqual(item["client_public_id"], str(client.public_id))
        self.assertIsNone(item["project_public_id"])
        for forbidden in ("pk", "idempotency_key", "fingerprint", "request_fingerprint", "created_by", "workspace", "category", "client", "project", "reversal_of"):
            self.assertNotIn(forbidden, item)
        self.assertNotIn(str(foreign_entry.public_id), {value["public_id"] for value in response.json()["data"]["items"]})
        self.assertEqual(list(LedgerEntry.objects.values_list("pk", "public_id", "created_at")), before)

    @patch("api.auth_views.time.time", return_value=1_000_000)
    def test_rejects_every_query_shape_except_one_nonempty_cursor_and_returns_json_405(self, mocked_time):
        self.authenticate(workspace=self.workspace)
        for path in (
            "/api/v1/ledger-entries/?workspace=ignored", "/api/v1/ledger-entries/?cursor=",
            "/api/v1/ledger-entries/?cursor=one&cursor=two", "/api/v1/ledger-entries/?cursor=malformed",
        ):
            response = self.client.get(path)
            self.assertEqual(response.status_code, 400)
            self.assertEqual(response.json(), {"error": {"code": "invalid_request"}})
        from api.ledger_views import CURSOR_SIGNER
        unknown = CURSOR_SIGNER.sign("v1.unknown")
        self.assertEqual(self.client.get(f"/api/v1/ledger-entries/?cursor={unknown}").status_code, 400)
        response = self.client.post("/api/v1/ledger-entries/")
        self.assertEqual(response.status_code, 405)
        self.assertEqual(response.json(), {"error": {"code": "method_not_allowed"}})
        self.assertEqual(response["Allow"], "GET, HEAD, OPTIONS")

    @patch("api.auth_views.time.time", return_value=1_000_000)
    @patch("api.ledger_views.current_time", return_value=1_000_000)
    def test_cursor_is_keyset_ordered_without_duplicates_or_misses_and_rejects_tampering_and_expiry(self, mocked_cursor_time, mocked_auth_time):
        entries = [self.make_entry() for _ in range(26)]
        self.authenticate(workspace=self.workspace)

        first = self.client.get("/api/v1/ledger-entries/")
        cursor = first.json()["data"]["next_cursor"]
        second = self.client.get(f"/api/v1/ledger-entries/?cursor={cursor}")
        items = first.json()["data"]["items"] + second.json()["data"]["items"]

        self.assertEqual(len(first.json()["data"]["items"]), 25)
        self.assertEqual(len(second.json()["data"]["items"]), 1)
        self.assertEqual(len({item["public_id"] for item in items}), 26)
        self.assertEqual([item["public_id"] for item in items], [str(entry.public_id) for entry in reversed(entries)])
        self.assertEqual(self.client.get(f"/api/v1/ledger-entries/?cursor={cursor}x").status_code, 400)
        mocked_cursor_time.return_value = 1_000_101
        self.assertEqual(self.client.get(f"/api/v1/ledger-entries/?cursor={cursor}").status_code, 400)

    @patch("api.auth_views.time.time", return_value=1_000_000)
    @patch("api.ledger_views.current_time", return_value=1_000_000)
    def test_cursor_is_bound_to_session_subject_workspace_membership_and_deadline(self, mocked_cursor_time, mocked_auth_time):
        for _ in range(26):
            self.make_entry()
        self.authenticate(workspace=self.workspace)
        cursor = self.client.get("/api/v1/ledger-entries/").json()["data"]["next_cursor"]
        from api.ledger_views import CURSOR_SESSION_KEY, CURSOR_SIGNER

        nonce = CURSOR_SIGNER.unsign(cursor).split(".", 1)[1]
        original = {"subject": str(self.user.pk), "workspace": str(self.workspace.public_id), "membership": self.membership.pk, "deadline": 1_000_100}
        for field, value in (("subject", "foreign"), ("workspace", str(uuid4())), ("membership", 999), ("deadline", 999)):
            session = self.client.session
            session[CURSOR_SESSION_KEY][nonce][field] = value
            session.save()
            self.assertEqual(self.client.get(f"/api/v1/ledger-entries/?cursor={cursor}").status_code, 400)
            session = self.client.session
            session[CURSOR_SESSION_KEY][nonce][field] = original[field]
            session.save()

        other_client = Client()
        other_client.force_login(self.user)
        session = other_client.session
        session["api.auth_expires_at"] = 1_000_100
        session["workspaces.active_workspace_public_id"] = str(self.workspace.public_id)
        session.save()
        response = other_client.get(f"/api/v1/ledger-entries/?cursor={cursor}")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"error": {"code": "invalid_request"}})


class LedgerEntryCursorStorageTests(TestCase):
    @patch("api.ledger_views.current_time", return_value=100)
    def test_cursor_store_prunes_expired_records_and_caps_live_entries(self, mocked_time):
        from api.ledger_views import AUTH_EXPIRY_SESSION_KEY, CURSOR_MAX_ENTRIES, CURSOR_SESSION_KEY, _new_cursor

        request = SimpleNamespace(user=SimpleNamespace(pk=7), session={AUTH_EXPIRY_SESSION_KEY: 1_000})
        context = SimpleNamespace(workspace=SimpleNamespace(public_id="workspace"), membership=SimpleNamespace(pk=3))
        request.session[CURSOR_SESSION_KEY] = {"expired": {"deadline": 99}, **{str(index): {"deadline": 1_000} for index in range(CURSOR_MAX_ENTRIES)}}
        _new_cursor(request, context, {"occurred_on": date(2024, 1, 1), "pk": 999})
        cursors = request.session[CURSOR_SESSION_KEY]
        self.assertEqual(len(cursors), CURSOR_MAX_ENTRIES)
        self.assertNotIn("expired", cursors)
        self.assertNotIn("0", cursors)


class InterfacePreferencesApiTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            email="preferences-api@example.com", password="correct-horse-battery-staple"
        )
        self.workspace = Workspace.objects.create(name="Preferences API Studio", slug="preferences-api-studio")
        self.membership = Membership.objects.create(
            workspace=self.workspace, user=self.user, role=Membership.Role.OWNER
        )

    def authenticate(self, *, user=None, workspace=None):
        self.client.force_login(user or self.user)
        session = self.client.session
        session["api.auth_expires_at"] = 1_000_100
        if workspace is not None:
            session["workspaces.active_workspace_public_id"] = str(workspace.public_id)
        session.save()

    def patch_json(self, client, payload, **extra):
        return client.patch(
            "/api/v1/preferences/",
            data=json.dumps(payload),
            content_type="application/json",
            **extra,
        )

    @patch("api.auth_views.time.time", return_value=1_000_000)
    def test_requires_live_session_and_trusted_active_workspace_membership(self, mocked_time):
        self.assertEqual(self.client.get("/api/v1/preferences/").status_code, 401)
        self.authenticate()
        self.assertEqual(self.client.get("/api/v1/preferences/").status_code, 400)
        self.authenticate(workspace=self.workspace)
        self.assertEqual(self.client.get("/api/v1/preferences/").status_code, 200)
        superuser = get_user_model().objects.create_superuser(
            email="preferences-superuser@example.com", password="correct-horse-battery-staple"
        )
        self.authenticate(user=superuser, workspace=self.workspace)
        response = self.client.get("/api/v1/preferences/")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"error": {"code": "workspace_required"}})

    @patch("api.auth_views.time.time", return_value=1_000_000)
    def test_get_allows_every_valid_role_and_returns_only_own_active_membership_preferences(self, mocked_time):
        self.authenticate(workspace=self.workspace)
        for role in (Membership.Role.OWNER, Membership.Role.OPERATIONAL, Membership.Role.ADMINISTRATIVE):
            with allow_membership_writes():
                Membership.objects.filter(pk=self.membership.pk).update(role=role)
            self.patch_json(self.client, {"sidebar_collapsed": False})
            response = self.client.get("/api/v1/preferences/")
            self.assertEqual(response.status_code, 200)
            self.assertEqual(set(response.json()["data"]), {"sidebar_collapsed", "created_at", "updated_at"})
            self.assertFalse(response.json()["data"]["sidebar_collapsed"])
            updated = self.patch_json(self.client, {"sidebar_collapsed": True})
            self.assertEqual(updated.status_code, 200)
            self.assertTrue(updated.json()["data"]["sidebar_collapsed"])
            self.assertEqual(response["Cache-Control"], "no-store")

    @patch("api.auth_views.time.time", return_value=1_000_000)
    def test_patch_updates_only_boolean_sidebar_collapsed_for_current_membership(self, mocked_time):
        self.authenticate(workspace=self.workspace)
        csrf_client = Client(enforce_csrf_checks=True)
        csrf_client.force_login(self.user)
        session = csrf_client.session
        session["api.auth_expires_at"] = 1_000_100
        session["workspaces.active_workspace_public_id"] = str(self.workspace.public_id)
        session.save()
        token = csrf_client.get("/api/v1/session/").cookies["csrftoken"].value
        response = self.patch_json(csrf_client, {"sidebar_collapsed": True}, HTTP_X_CSRFTOKEN=token)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["data"]["sidebar_collapsed"], True)
        self.assertEqual(self.client.get("/api/v1/preferences/").json()["data"]["sidebar_collapsed"], True)
        self.assertEqual(response["Cache-Control"], "no-store")

    @patch("api.auth_views.time.time", return_value=1_000_000)
    def test_rejects_query_parameters_and_invalid_patch_payloads(self, mocked_time):
        self.authenticate(workspace=self.workspace)
        self.assertEqual(self.client.get("/api/v1/preferences/?workspace=ignored").json(), {"error": {"code": "invalid_request"}})
        invalid_json = self.client.patch("/api/v1/preferences/", data="{", content_type="application/json")
        self.assertEqual(invalid_json.status_code, 400)
        self.assertEqual(invalid_json.json(), {"error": {"code": "invalid_json"}})
        for payload in ([], {}, {"sidebar_collapsed": "true"}, {"sidebar_collapsed": 1}, {"sidebar_collapsed": None}, {"sidebar_collapsed": True, "workspace": "ignored"}):
            with self.subTest(payload=payload):
                response = self.patch_json(self.client, payload)
                self.assertEqual(response.status_code, 400)
                self.assertEqual(response.json(), {"error": {"code": "invalid_request"}})
        response = self.patch_json(self.client, {"sidebar_collapsed": True}, QUERY_STRING="workspace=ignored")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"error": {"code": "invalid_request"}})

    @patch("api.auth_views.time.time", return_value=1_000_000)
    def test_uses_json_405_and_rejects_non_json_patch_media_type(self, mocked_time):
        self.authenticate(workspace=self.workspace)
        response = self.client.post("/api/v1/preferences/")
        self.assertEqual(response.status_code, 405)
        self.assertEqual(response.json(), {"error": {"code": "method_not_allowed"}})
        self.assertEqual(response["Allow"], "GET, PATCH, HEAD, OPTIONS")
        response = self.client.patch("/api/v1/preferences/", data="sidebar_collapsed=true", content_type="text/plain")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"error": {"code": "invalid_request"}})


class CashActivityReportApiTests(TestCase):
    path = "/api/v1/reports/cash-activity/"

    def setUp(self):
        self.user = get_user_model().objects.create_user(
            email="cash-activity-api@example.com", password="correct-horse-battery-staple"
        )
        self.other_user = get_user_model().objects.create_user(
            email="cash-activity-other-api@example.com", password="correct-horse-battery-staple"
        )
        self.workspace = Workspace.objects.create(name="Cash Activity API", slug="cash-activity-api")
        self.membership = Membership.objects.create(
            workspace=self.workspace, user=self.user, role=Membership.Role.OWNER
        )
        self.context = ActiveWorkspaceContext(self.workspace, self.membership)
        self.category = create_category(
            self.context,
            name="Cash Activity",
            description="Cash activity category",
            default_deductible=True,
            monthly_budget=None,
            status=Category.Status.ACTIVE,
        )

    def authenticate(self, *, expires_at=1_000_100, workspace=None, user=None):
        self.client.force_login(user or self.user)
        session = self.client.session
        session["api.auth_expires_at"] = expires_at
        if workspace is not None:
            session["workspaces.active_workspace_public_id"] = str(workspace.public_id)
        session.save()

    def make_expense(self, *, context=None, category=None, amount=Decimal("12.50"), occurred_on=date(2026, 5, 1)):
        from ledger.models import LedgerEntry
        from ledger.services import record_manual_entry

        return record_manual_entry(
            context or self.context,
            idempotency_key=uuid4(),
            direction=LedgerEntry.Direction.EXPENSE,
            amount=amount,
            occurred_on=occurred_on,
            description="Cash activity expense",
            category=category or self.category,
        )

    def issued_invoice(self):
        proposal = create_proposal(self.context, ClientModel.objects.create(
            workspace=self.workspace,
            legal_name="Cash Activity Client",
            client_type=ClientModel.ClientType.COMPANY,
            tax_identifier="CASH-ACTIVITY-CLIENT",
            primary_contact_name="Cash Activity Contact",
            primary_contact_email="cash-activity-client@example.com",
        ), "Cash activity proposal", date(2026, 5, 1), date(2026, 5, 1))
        add_line_item(
            self.context,
            proposal,
            position=1,
            service_name="Cash activity service",
            description="Cash activity service",
            unit_of_measure="HOUR",
            quantity=Decimal("1.00"),
            unit_rate=Decimal("10.00"),
        )
        proposal = transition_proposal(
            self.context,
            send_proposal(self.context, proposal),
            Proposal.Status.ACCEPTED,
        )
        project = convert_accepted_proposal(self.context, proposal)
        create_fiscal_configuration(
            self.context,
            legal_name="Cash Activity LLC",
            tax_identifier="CASH-ACTIVITY-TAX",
            tax_regime="GENERAL",
            applies_vat=False,
            vat_rate=Decimal("0.00"),
            withholding_rate=Decimal("0.00"),
        )
        return issue_invoice(self.context, create_draft_invoice(self.context, project))

    @patch("api.auth_views.time.time", return_value=1_000_000)
    def test_requires_live_session_trusted_context_and_fresh_operational_membership(self, mocked_time):
        query = "?start_date=2026-05-01&end_date=2026-05-01"
        self.assertEqual(self.client.get(self.path + query).status_code, 401)
        self.authenticate(expires_at=999_999, workspace=self.workspace)
        self.assertEqual(self.client.get(self.path + query).status_code, 401)
        self.authenticate()
        self.assertEqual(self.client.get(self.path + query).json(), {"error": {"code": "workspace_required"}})
        self.authenticate(workspace=self.workspace)
        for role, status in (
            (Membership.Role.OWNER, 200),
            (Membership.Role.OPERATIONAL, 200),
            (Membership.Role.ADMINISTRATIVE, 403),
        ):
            with allow_membership_writes():
                Membership.objects.filter(pk=self.membership.pk).update(role=role)
            self.assertEqual(self.client.get(self.path + query).status_code, status)
        superuser = get_user_model().objects.create_superuser(
            email="cash-activity-superuser@example.com", password="correct-horse-battery-staple"
        )
        self.authenticate(workspace=self.workspace, user=superuser)
        response = self.client.get(self.path + query)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"error": {"code": "workspace_required"}})
        self.authenticate(workspace=self.workspace)
        with allow_membership_writes():
            Membership.objects.filter(pk=self.membership.pk).delete()
        self.assertEqual(self.client.get(self.path + query).json(), {"error": {"code": "workspace_required"}})

    @patch("api.auth_views.time.time", return_value=1_000_000)
    def test_projects_only_public_totals_decimal_strings_and_current_tenant(self, mocked_time):
        from ledger.models import LedgerEntry

        entry = self.make_expense(amount=Decimal("12.50"))
        foreign_workspace = Workspace.objects.create(name="Foreign Cash Activity", slug="foreign-cash-activity")
        foreign_membership = Membership.objects.create(
            workspace=foreign_workspace, user=self.other_user, role=Membership.Role.OWNER
        )
        foreign_context = ActiveWorkspaceContext(foreign_workspace, foreign_membership)
        foreign_category = create_category(
            foreign_context,
            name="Foreign Cash Activity",
            description="Foreign cash activity category",
            default_deductible=True,
            monthly_budget=None,
            status=Category.Status.ACTIVE,
        )
        foreign_entry = self.make_expense(
            context=foreign_context, category=foreign_category, amount=Decimal("99.99")
        )
        before = list(LedgerEntry.objects.values_list("pk", "amount", "created_at"))
        self.authenticate(workspace=self.workspace)

        response = self.client.get(self.path + "?start_date=2026-05-01&end_date=2026-05-01")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Cache-Control"], "no-store")
        data = response.json()["data"]
        self.assertEqual(set(data), {
            "start_date", "end_date", "timezone", "as_of", "cash_in", "cash_out", "net",
            "by_client", "by_project", "by_category",
        })
        self.assertEqual(data["start_date"], "2026-05-01")
        self.assertEqual(data["end_date"], "2026-05-01")
        self.assertEqual(data["timezone"], "America/Guayaquil")
        self.assertIsInstance(data["as_of"], str)
        self.assertEqual((data["cash_in"], data["cash_out"], data["net"]), ("0.00", "12.50", "-12.50"))
        self.assertEqual(data["by_client"], [])
        self.assertEqual(data["by_project"], [])
        self.assertEqual(data["by_category"], [{"cash_in": "0.00", "cash_out": "12.50", "net": "-12.50"}])
        self.assertNotIn(str(entry.public_id), response.content.decode())
        self.assertNotIn(str(foreign_entry.public_id), response.content.decode())
        self.assertEqual(list(LedgerEntry.objects.values_list("pk", "amount", "created_at")), before)

    @patch("api.auth_views.time.time", return_value=1_000_000)
    def test_accepts_only_exact_date_query_with_inclusive_366_day_limit(self, mocked_time):
        self.authenticate(workspace=self.workspace)
        self.assertEqual(
            self.client.get(self.path + "?start_date=2024-01-01&end_date=2024-12-31").status_code,
            200,
        )
        for query in (
            "",
            "?start_date=2026-05-01",
            "?end_date=2026-05-01",
            "?start_date=&end_date=2026-05-01",
            "?start_date=2026-05-01&end_date=",
            "?start_date=20260501&end_date=2026-05-01",
            "?start_date=2026-02-30&end_date=2026-05-01",
            "?start_date=2026-05-02&end_date=2026-05-01",
            "?start_date=2024-01-01&end_date=2025-01-01",
            "?start_date=9999-12-31&end_date=9999-12-31",
            "?start_date=2026-05-01&end_date=2026-05-01&workspace=ignored",
            "?start_date=2026-05-01&start_date=2026-05-01&end_date=2026-05-01",
        ):
            response = self.client.get(self.path + query)
            self.assertEqual(response.status_code, 400, query)
            self.assertEqual(response.json(), {"error": {"code": "invalid_request"}}, query)

    @patch("api.auth_views.time.time", return_value=1_000_000)
    def test_uses_guayaquil_dates_and_keeps_reversals_as_separate_events(self, mocked_time):
        invoice = self.issued_invoice()
        payment = record_payment(
            self.context,
            invoice,
            amount=Decimal("10.00"),
            idempotency_key=uuid4(),
            source_type="CASH",
            source_reference=uuid4().hex,
            received_at=datetime(2026, 5, 2, 2, 30, tzinfo=datetime_timezone.utc),
        )
        reverse_payment(
            self.context,
            invoice,
            payment,
            idempotency_key=uuid4(),
            reason="Returned",
            reversed_at=datetime(2026, 5, 3, 5, 30, tzinfo=datetime_timezone.utc),
        )
        self.authenticate(workspace=self.workspace)

        receipt = self.client.get(self.path + "?start_date=2026-05-01&end_date=2026-05-01")
        reversal = self.client.get(self.path + "?start_date=2026-05-03&end_date=2026-05-03")

        self.assertEqual((receipt.json()["data"]["cash_in"], receipt.json()["data"]["cash_out"]), ("10.00", "0.00"))
        self.assertEqual((reversal.json()["data"]["cash_in"], reversal.json()["data"]["cash_out"]), ("0.00", "10.00"))

    @patch("api.auth_views.time.time", return_value=1_000_000)
    def test_rejects_non_get_methods_as_json(self, mocked_time):
        self.authenticate(workspace=self.workspace)
        response = self.client.post(self.path + "?start_date=2026-05-01&end_date=2026-05-01")
        self.assertEqual(response.status_code, 405)
        self.assertEqual(response.json(), {"error": {"code": "method_not_allowed"}})
        self.assertEqual(response["Allow"], "GET, HEAD, OPTIONS")
        self.assertEqual(response["Cache-Control"], "no-store")
