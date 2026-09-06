"""Start a localhost-only Django server backed by a disposable MySQL test database.

Use only with FREELANCEFLOW_BROWSER_E2E=1. Ctrl+C tears down the test database.
"""

import argparse
import os
import secrets


def parse_arguments():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default="127.0.0.1", choices=("127.0.0.1", "localhost"))
    parser.add_argument("--port", default=8011, type=int)
    return parser.parse_args()


def configure_environment():
    if os.environ.get("FREELANCEFLOW_BROWSER_E2E") != "1":
        raise SystemExit("Refusing to start: set FREELANCEFLOW_BROWSER_E2E=1.")
    os.environ.setdefault("DJANGO_SECRET_KEY", secrets.token_urlsafe(48))
    os.environ["FREELANCEFLOW_BROWSER_E2E_DATABASE"] = (
        f"test_freelanceflow_browser_{secrets.token_hex(8)}"
    )
    os.environ["DJANGO_SETTINGS_MODULE"] = "config.browser_e2e_settings"


def seed_browser_identity():
    from django.contrib.auth import get_user_model

    from workspaces.models import Membership, Workspace

    user = get_user_model().objects.create_user(
        email="browser-e2e@example.test", password="BrowserE2E!12345"
    )
    workspace = Workspace.objects.create(name="Browser E2E", slug="browser-e2e")
    Membership.objects.create(
        workspace=workspace, user=user, role=Membership.Role.OPERATIONAL
    )


def main():
    arguments = parse_arguments()
    configure_environment()

    import django

    django.setup()
    from django.conf import settings
    from django.core.management import call_command
    from django.test.utils import get_runner

    runner = get_runner(settings)(verbosity=1, interactive=False)
    old_config = None
    test_environment_ready = False
    try:
        runner.setup_test_environment()
        test_environment_ready = True
        old_config = runner.setup_databases(
            aliases={"default": False}, serialized_aliases=set()
        )
        seed_browser_identity()
        print(
            "Browser E2E server ready at "
            f"http://{arguments.host}:{arguments.port}/pages/acceso.html\n"
            "Login: browser-e2e@example.test / BrowserE2E!12345\n"
            "Select Browser E2E, then open Clientes. Ctrl+C drops the disposable database.",
            flush=True,
        )
        call_command(
            "runserver",
            f"{arguments.host}:{arguments.port}",
            use_reloader=False,
            use_threading=True,
            insecure=True,
        )
    finally:
        if old_config is not None:
            runner.teardown_databases(old_config)
        if test_environment_ready:
            runner.teardown_test_environment()


if __name__ == "__main__":
    main()
