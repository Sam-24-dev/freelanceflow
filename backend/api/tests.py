import json
from uuid import uuid4
from types import SimpleNamespace
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import Client, TestCase
from django.utils import timezone

from clients.models import Client as ClientModel
from services.models import Service
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
