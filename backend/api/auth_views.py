import json
import time
from functools import wraps

from django.contrib.auth import SESSION_KEY, authenticate, login, logout
from django.core.exceptions import RequestDataTooBig
from django.http import HttpResponse
from django.utils.decorators import method_decorator
from django.views import View
from django.views.decorators.csrf import ensure_csrf_cookie
from workspaces.context import WorkspaceContextError, resolve_active_workspace_context
from workspaces.permissions import WorkspacePermissionDenied

from .http import json_data, json_error

AUTH_EXPIRY_SESSION_KEY = "api.auth_expires_at"
ACTIVE_WORKSPACE_SESSION_KEY = "workspaces.active_workspace_public_id"
AUTH_LIFETIME_SECONDS = 28_800
MAX_LOGIN_BODY_BYTES = 16 * 1024


def authenticated_api_user(request):
    """Return the API user, flushing expired or malformed authenticated sessions."""
    if not request.user.is_authenticated:
        if SESSION_KEY in request.session:
            logout(request)
        return None
    if not request.user.is_active:
        logout(request)
        return None
    expires_at = request.session.get(AUTH_EXPIRY_SESSION_KEY)
    if not isinstance(expires_at, (int, float)) or expires_at <= time.time():
        logout(request)
        return None
    return request.user


def require_api_auth(view_func):
    """Apply the absolute API session deadline to future authenticated endpoints."""
    @wraps(view_func)
    def wrapped(request, *args, **kwargs):
        if authenticated_api_user(request) is None:
            return json_error("authentication_required", status=401)
        return view_func(request, *args, **kwargs)
    return wrapped


def _login_payload(request):
    if request.content_type != "application/json":
        return None, json_error("unsupported_media_type", status=415)
    try:
        if int(request.META.get("CONTENT_LENGTH") or 0) > MAX_LOGIN_BODY_BYTES:
            return None, json_error("request_too_large", status=413)
    except (TypeError, ValueError):
        pass
    try:
        body = request.body
    except RequestDataTooBig:
        return None, json_error("request_too_large", status=413)
    if len(body) > MAX_LOGIN_BODY_BYTES:
        return None, json_error("request_too_large", status=413)
    try:
        payload = json.loads(body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return None, json_error("invalid_json", status=400)
    if not isinstance(payload, dict) or set(payload) != {"email", "password"}:
        return None, json_error("invalid_request", status=400)
    if not all(isinstance(value, str) for value in payload.values()):
        return None, json_error("invalid_request", status=400)
    return payload, None


class JsonMethodView(View):
    def http_method_not_allowed(self, request, *args, **kwargs):
        response = json_error("method_not_allowed", status=405)
        response["Allow"] = ", ".join(self._allowed_methods())
        return response


@method_decorator(ensure_csrf_cookie, name="dispatch")
class SessionView(JsonMethodView):
    def get(self, request):
        authenticated = authenticated_api_user(request) is not None
        active_workspace = None
        if authenticated:
            try:
                context = resolve_active_workspace_context(request)
            except (WorkspaceContextError, WorkspacePermissionDenied):
                pass
            else:
                workspace = context.workspace
                active_workspace = {
                    "workspace_public_id": str(workspace.public_id),
                    "workspace_name": workspace.name,
                    "workspace_slug": workspace.slug,
                    "role": context.membership.role,
                }
        return json_data({"authenticated": authenticated, "active_workspace": active_workspace})


class SessionLoginView(JsonMethodView):
    def post(self, request):
        payload, error_response = _login_payload(request)
        if error_response is not None:
            return error_response
        user = authenticate(request, email=payload["email"], password=payload["password"])
        if user is None:
            return json_error("invalid_credentials", status=401)
        login(request, user)
        request.session.pop(ACTIVE_WORKSPACE_SESSION_KEY, None)
        request.session[AUTH_EXPIRY_SESSION_KEY] = int(time.time()) + AUTH_LIFETIME_SECONDS
        return json_data({"authenticated": True, "active_workspace": None})


class SessionLogoutView(JsonMethodView):
    def post(self, request):
        logout(request)
        response = HttpResponse(status=204)
        response["Cache-Control"] = "no-store"
        return response
