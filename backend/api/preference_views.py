"""Session-bound active-workspace interface preferences endpoint."""

import json

from django.utils.decorators import method_decorator

from preferences.services import (
    InterfacePreferenceAccessDenied,
    get_interface_preferences,
    update_interface_preferences,
)
from workspaces.context import WorkspaceContextError, resolve_active_workspace_context

from .auth_views import JsonMethodView, require_api_auth
from .http import json_data, json_error

READ_FIELDS = ("sidebar_collapsed", "created_at", "updated_at")


def _serialize(preferences):
    return {field: getattr(preferences, field) for field in READ_FIELDS}


def _patch_payload(request):
    if request.content_type != "application/json":
        return None, json_error("invalid_request", status=400)
    try:
        payload = json.loads(request.body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return None, json_error("invalid_json", status=400)
    if not isinstance(payload, dict) or set(payload) != {"sidebar_collapsed"}:
        return None, json_error("invalid_request", status=400)
    if type(payload["sidebar_collapsed"]) is not bool:
        return None, json_error("invalid_request", status=400)
    return payload, None


class InterfacePreferencesView(JsonMethodView):
    @method_decorator(require_api_auth)
    def get(self, request):
        if request.GET:
            return json_error("invalid_request", status=400)
        return self._read(request)

    @method_decorator(require_api_auth)
    def patch(self, request):
        if request.GET:
            return json_error("invalid_request", status=400)
        payload, error_response = _patch_payload(request)
        if error_response is not None:
            return error_response
        try:
            context = resolve_active_workspace_context(request)
            preferences = update_interface_preferences(context, payload["sidebar_collapsed"])
        except (InterfacePreferenceAccessDenied, WorkspaceContextError):
            return json_error("workspace_required", status=400)
        return json_data(_serialize(preferences))

    def _read(self, request):
        try:
            context = resolve_active_workspace_context(request)
            preferences = get_interface_preferences(context)
        except (InterfacePreferenceAccessDenied, WorkspaceContextError):
            return json_error("workspace_required", status=400)
        return json_data(_serialize(preferences))
