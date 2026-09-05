from io import BytesIO
from os.path import join

from django.contrib.staticfiles import finders
from django.contrib.staticfiles.handlers import StaticFilesHandler
from django.core.handlers.wsgi import WSGIHandler
from django.test import SimpleTestCase


class FrontendRoutingTests(SimpleTestCase):
    def test_landing_access_and_dashboard_are_explicit_same_origin_pages(self):
        for path, marker in (
            ("/", "FreelanceFlow"),
            ("/pages/acceso.html", "Contexto de trabajo"),
            ("/pages/dashboard.html", "Dashboard"),
        ):
            with self.subTest(path=path):
                response = self.client.get(path)
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response["Content-Type"], "text/html; charset=utf-8")
                self.assertContains(response, marker)

    def test_staticfiles_finders_expose_only_configured_frontend_assets(self):
        for path in (
            join("assets", "css", "styles.css"),
            join("assets", "js", "app-shell.js"),
            join("img", "brand", "freelanceflow-logo-color.svg"),
        ):
            with self.subTest(path=path):
                self.assertIsNotNone(finders.find(path))

    def test_staticfiles_handler_claims_only_the_static_prefix(self):
        handler = StaticFilesHandler(WSGIHandler())

        self.assertTrue(handler._should_handle("/static/assets/css/styles.css"))
        for path in ("/", "/pages/dashboard.html", "/api/v1/session/"):
            with self.subTest(path=path):
                self.assertFalse(handler._should_handle(path))

    def test_staticfiles_handler_serves_assets_without_claiming_django_routes(self):
        status = []

        def start_response(response_status, _headers):
            status.append(response_status)

        environ = {
            "REQUEST_METHOD": "GET",
            "PATH_INFO": "/static/assets/css/styles.css",
            "SCRIPT_NAME": "",
            "QUERY_STRING": "",
            "SERVER_NAME": "testserver",
            "SERVER_PORT": "80",
            "SERVER_PROTOCOL": "HTTP/1.1",
            "wsgi.version": (1, 0),
            "wsgi.url_scheme": "http",
            "wsgi.input": BytesIO(),
            "wsgi.errors": BytesIO(),
            "wsgi.multithread": False,
            "wsgi.multiprocess": False,
            "wsgi.run_once": False,
        }
        response = StaticFilesHandler(WSGIHandler())(environ, start_response)
        try:
            body = b"".join(response)
        finally:
            close = getattr(response, "close", None)
            if close:
                close()

        self.assertTrue(status[0].startswith("200"))
        self.assertIn(b"--ff-bg", body)

    def test_existing_asset_paths_redirect_to_the_static_prefix(self):
        for path, location in (
            ("/assets/css/styles.css", "/static/assets/css/styles.css"),
            ("/img/brand/freelanceflow-logo-color.svg", "/static/img/brand/freelanceflow-logo-color.svg"),
        ):
            with self.subTest(path=path):
                response = self.client.get(path)
                self.assertEqual(response.status_code, 301)
                self.assertEqual(response["Location"], location)

    def test_asset_aliases_reject_traversal(self):
        for path in (
            "/assets/../backend/config/settings.py",
            "/assets/%2e%2e/backend/config/settings.py",
            "/img/../backend/config/settings.py",
        ):
            with self.subTest(path=path):
                self.assertEqual(self.client.get(path).status_code, 404)

    def test_manifest_and_robots_keep_their_explicit_types(self):
        for path, content_type in (
            ("/site.webmanifest", "application/manifest+json"),
            ("/robots.txt", "text/plain; charset=utf-8"),
        ):
            with self.subTest(path=path):
                response = self.client.get(path)
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response["Content-Type"], content_type)

    def test_unknown_and_traversal_paths_are_not_frontend_routes(self):
        for path in (
            "/pages/unknown.html",
            "/pages/../../backend/config/settings.py",
            "/docs/FREELANCEFLOW_FULL_INTEGRATION_ROADMAP.md",
        ):
            with self.subTest(path=path):
                self.assertEqual(self.client.get(path).status_code, 404)

    def test_api_session_route_remains_unchanged(self):
        response = self.client.get("/api/v1/session/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"data": {"authenticated": False, "active_workspace": None}})
        self.assertEqual(response["Content-Type"], "application/json; charset=utf-8")
