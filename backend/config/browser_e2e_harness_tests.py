"""Tests for the opt-in disposable browser-E2E settings."""

import json
import os
from pathlib import Path
import subprocess
import sys
import unittest


BACKEND_DIR = Path(__file__).resolve().parent.parent


def settings_process(**overrides):
    environment = {
        "DJANGO_SECRET_KEY": "test-only-secret",
        "DJANGO_DB_NAME": "freelanceflow_local",
        "DJANGO_DB_USER": "unused",
        "DJANGO_DB_PASSWORD": "unused",
        "DJANGO_DB_HOST": "127.0.0.1",
        "DJANGO_DB_PORT": "3306",
        "PYTHONPATH": str(BACKEND_DIR),
    }
    environment.update(overrides)
    code = (
        "import json; import config.browser_e2e_settings as settings; "
        "print(json.dumps({'debug': settings.DEBUG, 'hosts': settings.ALLOWED_HOSTS, "
        "'database': settings.DATABASES['default']['TEST']['NAME']}))"
    )
    return subprocess.run(
        [sys.executable, "-c", code],
        cwd=BACKEND_DIR,
        env=environment,
        capture_output=True,
        text=True,
        check=False,
    )


class BrowserE2ESettingsTests(unittest.TestCase):
    def test_settings_refuse_unrequested_use(self):
        result = settings_process()

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("FREELANCEFLOW_BROWSER_E2E=1", result.stderr)

    def test_settings_refuse_non_disposable_database_name(self):
        result = settings_process(
            FREELANCEFLOW_BROWSER_E2E="1",
            FREELANCEFLOW_BROWSER_E2E_DATABASE="test_freelanceflow_local",
        )

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("test_freelanceflow_browser_", result.stderr)

    def test_settings_allow_loopback_with_a_scoped_disposable_database(self):
        database_name = "test_freelanceflow_browser_unittest"
        result = settings_process(
            FREELANCEFLOW_BROWSER_E2E="1",
            FREELANCEFLOW_BROWSER_E2E_DATABASE=database_name,
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(
            json.loads(result.stdout),
            {"debug": True, "hosts": ["127.0.0.1", "localhost"], "database": database_name},
        )


if __name__ == "__main__":
    unittest.main()
