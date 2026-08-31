"""Read-only active-workspace payment directory with session-bound cursors."""

import secrets
from time import time as current_time

from django.core.signing import BadSignature, SignatureExpired, TimestampSigner
from django.db.models import Q
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.utils.decorators import method_decorator

from payments.services import PaymentAccessDenied, get_payments_for_workspace
from workspaces.context import WorkspaceContextError, resolve_active_workspace_context
from workspaces.permissions import WorkspacePermissionDenied

from .auth_views import AUTH_EXPIRY_SESSION_KEY, JsonMethodView, require_api_auth
from .http import json_data, json_error


CURSOR_PAGE_SIZE = 25
CURSOR_MAX_ENTRIES = 128
CURSOR_SESSION_KEY = "api.payments.cursors"
CURSOR_VERSION = "v1"
CURSOR_SIGNER = TimestampSigner(salt="api.payments.cursor.v1")
READ_FIELDS = (
    "public_id",
    "invoice_public_id",
    "invoice_number_snapshot",
    "amount",
    "received_at",
    "reversed_at",
)


def _cursor_error():
    return json_error("invalid_request", status=400)


def _request_cursor(request):
    if not request.GET:
        return None, None
    if set(request.GET) != {"cursor"} or len(request.GET.getlist("cursor")) != 1:
        return None, _cursor_error()
    value = request.GET["cursor"]
    return (value, None) if value else (None, _cursor_error())


def _read_cursor(request, context, value):
    try:
        version, nonce = CURSOR_SIGNER.unsign(value).split(".", 1)
        if version != CURSOR_VERSION or not nonce:
            raise ValueError
        cursors = request.session.get(CURSOR_SESSION_KEY)
        stored = cursors.get(nonce) if isinstance(cursors, dict) else None
        deadline = request.session.get(AUTH_EXPIRY_SESSION_KEY)
        if (
            not isinstance(stored, dict)
            or stored.get("subject") != str(request.user.pk)
            or stored.get("workspace") != str(context.workspace.public_id)
            or stored.get("membership") != context.membership.pk
            or stored.get("deadline") != deadline
            or not isinstance(deadline, (int, float))
            or deadline <= current_time()
        ):
            raise ValueError
        received_at = parse_datetime(stored.get("received_at", ""))
        pk = stored.get("pk")
        if received_at is None or timezone.is_naive(received_at) or not isinstance(pk, int) or pk <= 0:
            raise ValueError
        return received_at, pk, None
    except (BadSignature, SignatureExpired, ValueError, TypeError, AttributeError):
        return None, None, _cursor_error()


def _new_cursor(request, context, row):
    nonce = secrets.token_urlsafe(24)
    deadline = request.session.get(AUTH_EXPIRY_SESSION_KEY)
    now = current_time()
    cursors = request.session.get(CURSOR_SESSION_KEY)
    if not isinstance(cursors, dict):
        cursors = {}
    cursors = {
        key: value
        for key, value in cursors.items()
        if isinstance(value, dict)
        and value.get("deadline") == deadline
        and isinstance(deadline, (int, float))
        and deadline > now
    }
    while len(cursors) >= CURSOR_MAX_ENTRIES:
        cursors.pop(next(iter(cursors)))
    cursors[nonce] = {
        "received_at": row["received_at"].isoformat(),
        "pk": row["pk"],
        "workspace": str(context.workspace.public_id),
        "membership": context.membership.pk,
        "subject": str(request.user.pk),
        "deadline": deadline,
    }
    request.session[CURSOR_SESSION_KEY] = cursors
    return CURSOR_SIGNER.sign(f"{CURSOR_VERSION}.{nonce}")


def _serialize(row):
    return {field: row[field] for field in READ_FIELDS}


class PaymentListView(JsonMethodView):
    @method_decorator(require_api_auth)
    def get(self, request):
        cursor_value, error_response = _request_cursor(request)
        if error_response is not None:
            return error_response
        try:
            context = resolve_active_workspace_context(request)
            payments = get_payments_for_workspace(context)
        except (WorkspacePermissionDenied, PaymentAccessDenied):
            return json_error("permission_denied", status=403)
        except WorkspaceContextError:
            return json_error("workspace_required", status=400)
        if cursor_value is not None:
            cursor_received_at, cursor_pk, error_response = _read_cursor(request, context, cursor_value)
            if error_response is not None:
                return error_response
        else:
            cursor_received_at = cursor_pk = None
        payments = payments.order_by("-received_at", "-pk")
        if cursor_value is not None:
            payments = payments.filter(
                Q(received_at__lt=cursor_received_at)
                | Q(received_at=cursor_received_at, pk__lt=cursor_pk)
            )
        rows = list(payments.values(*READ_FIELDS, "pk")[: CURSOR_PAGE_SIZE + 1])
        page = rows[:CURSOR_PAGE_SIZE]
        return json_data({
            "items": [_serialize(row) for row in page],
            "next_cursor": _new_cursor(request, context, page[-1]) if len(rows) > CURSOR_PAGE_SIZE else None,
        })
