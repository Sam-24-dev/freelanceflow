"""Database-independent tests for the Django foundation."""

import os
import subprocess
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))
REQUIRED_ENVIRONMENT = {
    "DJANGO_SECRET_KEY": "test-secret-key-not-for-production",
    "DJANGO_DB_NAME": "freelanceflow_test",
    "DJANGO_DB_USER": "freelanceflow_test_user",
    "DJANGO_DB_PASSWORD": "test-password-not-for-production",
    "DJANGO_DB_HOST": "db.test.invalid",
    "DJANGO_DB_PORT": "3306",
}


class CriticalSettingsTests(unittest.TestCase):
    def test_settings_require_read_committed_isolation(self):
        environment = os.environ.copy()
        environment.update(REQUIRED_ENVIRONMENT)
        environment["PYTHONPATH"] = str(BACKEND_ROOT)

        command = (
            "import config.settings as settings; "
            "assert settings.DATABASES['default']['OPTIONS']['isolation_level'] == 'read committed'"
        )
        result = subprocess.run(
            [sys.executable, "-c", command],
            capture_output=True,
            text=True,
            env=environment,
            check=False,
        )

        self.assertEqual(result.returncode, 0, result.stderr)

    def test_settings_use_explicit_mysql_environment(self):
        environment = os.environ.copy()
        environment.update(REQUIRED_ENVIRONMENT)
        environment["PYTHONPATH"] = str(BACKEND_ROOT)

        command = (
            "import config.settings as settings; "
            "assert settings.DATABASES['default']['ENGINE'] == 'django.db.backends.mysql'; "
            "assert settings.DATABASES['default']['NAME'] == 'freelanceflow_test'; "
            "assert settings.DATABASES['default']['USER'] == 'freelanceflow_test_user'; "
            "assert settings.DATABASES['default']['PASSWORD'] == 'test-password-not-for-production'; "
            "assert settings.DATABASES['default']['HOST'] == 'db.test.invalid'; "
            "assert settings.DATABASES['default']['PORT'] == '3306'; "
            "assert settings.TIME_ZONE == 'America/Guayaquil'; "
            "assert settings.AUTH_USER_MODEL == 'accounts.User'"
        )
        result = subprocess.run(
            [sys.executable, "-c", command],
            capture_output=True,
            text=True,
            env=environment,
            check=False,
        )

        self.assertEqual(result.returncode, 0, result.stderr)

    def test_settings_reject_missing_critical_environment_values(self):
        for variable in REQUIRED_ENVIRONMENT:
            with self.subTest(variable=variable):
                environment = os.environ.copy()
                environment.update(REQUIRED_ENVIRONMENT)
                environment.pop(variable, None)
                environment["PYTHONPATH"] = str(BACKEND_ROOT)

                result = subprocess.run(
                    [sys.executable, "-c", "import config.settings"],
                    capture_output=True,
                    text=True,
                    env=environment,
                    check=False,
                )

                self.assertNotEqual(result.returncode, 0)
                self.assertIn(f"{variable} must be set.", result.stderr)


class UserNormalizationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        os.environ.update(REQUIRED_ENVIRONMENT)
        os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

        import django

        django.setup()

    def test_save_normalizes_email_before_persisting(self):
        from accounts.models import User

        user = User(email="  PERSON@Example.COM  ")
        with patch("django.contrib.auth.base_user.AbstractBaseUser.save") as persist:
            user.save()

        self.assertEqual(user.email, "person@example.com")
        persist.assert_called_once()

    def test_create_user_rejects_whitespace_only_email_without_persisting(self):
        from accounts.models import User

        with patch.object(User, "save") as persist:
            with self.assertRaisesRegex(ValueError, "email address must be set"):
                User.objects.create_user("   ")

        persist.assert_not_called()


if __name__ == "__main__":
    unittest.main()
