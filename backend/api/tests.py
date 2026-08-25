import json
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import Client, TestCase


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
