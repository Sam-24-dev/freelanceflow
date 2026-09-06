"""Settings used only by the disposable local browser-E2E server."""

import os
import re

from django.core.exceptions import ImproperlyConfigured

from .settings import *  # noqa: F403


if os.environ.get("FREELANCEFLOW_BROWSER_E2E") != "1":
    raise ImproperlyConfigured("Browser E2E settings require FREELANCEFLOW_BROWSER_E2E=1.")

_browser_database = os.environ.get("FREELANCEFLOW_BROWSER_E2E_DATABASE", "")
if not re.fullmatch(r"test_freelanceflow_browser_[a-z0-9_]+", _browser_database):
    raise ImproperlyConfigured(
        "FREELANCEFLOW_BROWSER_E2E_DATABASE must start with test_freelanceflow_browser_."
    )

DEBUG = True
ALLOWED_HOSTS = ["127.0.0.1", "localhost"]
DATABASES["default"]["TEST"] = {"NAME": _browser_database}  # noqa: F405
