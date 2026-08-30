import json
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import Client, TestCase

from workspaces.models import Membership, Workspace
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
