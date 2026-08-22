"""Django test runner support for immutable MySQL trigger suites."""

import hmac
import os
import secrets
import tempfile
import subprocess
import sys
from collections.abc import Iterable
from pathlib import Path
from unittest import TestSuite

from django.conf import settings
from django.test import TestCase, TransactionTestCase
from django.test.runner import DiscoverRunner


_ISOLATED_CHILD_MARKER_PATH_ENV = "FREELANCEFLOW_IMMUTABLE_TRIGGER_MARKER_PATH"
_ISOLATED_CHILD_TOKEN_ENV = "FREELANCEFLOW_IMMUTABLE_TRIGGER_TOKEN"
_DJANGO_RUNTIME_VARIABLES = (
    "DJANGO_SECRET_KEY",
    "DJANGO_DB_NAME",
    "DJANGO_DB_USER",
    "DJANGO_DB_PASSWORD",
    "DJANGO_DB_HOST",
    "DJANGO_DB_PORT",
)


def is_authenticated_isolated_child(environ) -> bool:
    """Accept child mode only with a one-time marker created by this runner."""
    marker_path = environ.get(_ISOLATED_CHILD_MARKER_PATH_ENV)
    token = environ.get(_ISOLATED_CHILD_TOKEN_ENV)
    if not marker_path or not token:
        return False
    try:
        marker_token = Path(marker_path).read_text(encoding="utf-8")
    except OSError:
        return False
    return hmac.compare_digest(marker_token, token)


def capture_django_runtime_environment(environ):
    """Capture required runtime configuration before tests can mutate it."""
    return {name: environ.get(name) for name in _DJANGO_RUNTIME_VARIABLES}


def child_environment(environ, runtime_environment):
    """Return a child environment restored to the run-start Django configuration."""
    child = dict(environ)
    for name in _DJANGO_RUNTIME_VARIABLES:
        value = runtime_environment.get(name)
        if value is None:
            child.pop(name, None)
        else:
            child[name] = value
    return child


def is_flush_unsafe_transaction_test(test) -> bool:
    """Return whether Django's DELETE-based TransactionTestCase flush is unsafe."""
    return isinstance(test, TransactionTestCase) and not isinstance(test, TestCase)


def _iter_tests(suite) -> Iterable:
    for test in suite:
        if isinstance(test, TestSuite):
            yield from _iter_tests(test)
        else:
            yield test


class ImmutableTriggerSafeDiscoverRunner(DiscoverRunner):
    """Run raw-concurrency cases in disposable databases instead of flushing facts.

    Immutable no-delete triggers are production behavior and must remain active
    during every test. Django's MySQL TransactionTestCase cleanup uses DELETE,
    so each non-TestCase transaction test is run in a child process with a new,
    disposable test database. The child skips only its fixture flush and Django
    drops that whole database at process end; no test data leaks to the suite.
    """

    def run_tests(self, test_labels, **kwargs):
        if is_authenticated_isolated_child(os.environ):
            if self.keepdb:
                raise RuntimeError("Isolated immutable-trigger tests refuse --keepdb.")
            return super().run_tests(test_labels, **kwargs)

        self._child_runtime_environment = capture_django_runtime_environment(os.environ)
        discovered = self.build_suite(test_labels)
        ordinary, isolated = self._partition(discovered)
        failures = 0
        if ordinary:
            failures += self._run_suite_with_database(TestSuite(ordinary))
        for test in isolated:
            failures += self._run_in_disposable_database(test)
        return failures

    def run_suite(self, suite, **kwargs):
        if not is_authenticated_isolated_child(os.environ):
            return super().run_suite(suite, **kwargs)

        original_teardown = TransactionTestCase._fixture_teardown

        def preserve_immutable_facts(_case):
            """Database destruction, not DELETE, cleans this isolated process."""

        TransactionTestCase._fixture_teardown = preserve_immutable_facts
        try:
            return super().run_suite(suite, **kwargs)
        finally:
            TransactionTestCase._fixture_teardown = original_teardown

    def _partition(self, suite):
        ordinary = []
        isolated = []
        for test in _iter_tests(suite):
            (isolated if is_flush_unsafe_transaction_test(test) else ordinary).append(test)
        return ordinary, isolated

    def _run_suite_with_database(self, suite):
        self.setup_test_environment()
        databases = self.get_databases(suite)
        suite.serialized_aliases = {
            alias for alias, serialize in databases.items() if serialize
        }
        suite.used_aliases = set(databases)
        old_config = self.setup_databases(
            aliases=databases,
            serialized_aliases=suite.serialized_aliases,
        )
        run_failed = False
        try:
            self.run_checks(databases)
            result = self.run_suite(suite)
        except Exception:
            run_failed = True
            raise
        finally:
            try:
                self.teardown_databases(old_config)
                self.teardown_test_environment()
            except Exception:
                if not run_failed:
                    raise
        return self.suite_result(suite, result)

    def _run_in_disposable_database(self, test) -> int:
        command = [
            sys.executable,
            str(Path(settings.BASE_DIR) / "manage.py"),
            "test",
            test.id(),
            "--verbosity",
            str(self.verbosity),
        ]
        if self.failfast:
            command.append("--failfast")
        runtime_environment = getattr(
            self,
            "_child_runtime_environment",
            capture_django_runtime_environment(os.environ),
        )
        environment = child_environment(os.environ, runtime_environment)
        token = secrets.token_urlsafe(32)
        marker_path = None
        try:
            with tempfile.NamedTemporaryFile(
                mode="w",
                encoding="utf-8",
                delete=False,
            ) as marker:
                marker.write(token)
                marker_path = Path(marker.name)
            environment[_ISOLATED_CHILD_MARKER_PATH_ENV] = str(marker_path)
            environment[_ISOLATED_CHILD_TOKEN_ENV] = token
            self.log("Running immutable-trigger transaction test in a disposable database: %s" % test.id())
            return 0 if subprocess.run(command, env=environment, check=False).returncode == 0 else 1
        finally:
            if marker_path is not None:
                marker_path.unlink(missing_ok=True)