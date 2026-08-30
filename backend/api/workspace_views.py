"""Authenticated workspace listing and explicit active-context selection."""

import json
from uuid import UUID

from django.core.exceptions import RequestDataTooBig
from django.utils.decorators import method_decorator
from workspaces.context import WorkspaceContextError, select_active_workspace
from workspaces.models import Membership
from workspaces.permissions import WorkspacePermissionDenied

from .auth_views import MAX_LOGIN_BODY_BYTES, JsonMethodView, require_api_auth
from .http import json_data, json_error


def _selection_payload(request):
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
    if not isinstance(payload, dict) or set(payload) != {"workspace_public_id"}:
        return None, json_error("invalid_request", status=400)
    public_id = payload["workspace_public_id"]
    if not isinstance(public_id, str):
        return None, json_error("invalid_request", status=400)
    try:
        parsed_public_id = UUID(public_id)
    except (TypeError, ValueError, AttributeError):
        return None, json_error("invalid_request", status=400)
    if str(parsed_public_id) != public_id:
        return None, json_error("invalid_request", status=400)
    return parsed_public_id, None


def _serialize_membership(membership):
    workspace = membership.workspace
    return {
        "workspace_public_id": str(workspace.public_id),
        "workspace_name": workspace.name,
        "workspace_slug": workspace.slug,
        "role": membership.role,
    }


class WorkspaceListView(JsonMethodView):
    @method_decorator(require_api_auth)
    def get(self, request):
        if request.GET:
            return json_error("invalid_request", status=400)
        memberships = Membership.objects.select_related("workspace").filter(
            user=request.user
        ).order_by("workspace__name", "id")
        return json_data({"workspaces": [_serialize_membership(item) for item in memberships]})


class ActiveWorkspaceSelectionView(JsonMethodView):
    @method_decorator(require_api_auth)
    def post(self, request):
        if request.GET:
            return json_error("invalid_request", status=400)
        public_id, error_response = _selection_payload(request)
        if error_response is not None:
            return error_response
        try:
            context = select_active_workspace(request, public_id)
        except (WorkspaceContextError, WorkspacePermissionDenied):
            return json_error("workspace_not_available", status=404)
        return json_data({"workspace_public_id": str(context.workspace.public_id)})
