import json
from uuid import uuid4
from types import SimpleNamespace
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import Client, TestCase
from django.utils import timezone

from workspaces.models import Membership, Workspace, allow_membership_writes
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
