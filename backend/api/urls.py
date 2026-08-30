from django.urls import path

from .auth_views import SessionLoginView, SessionLogoutView, SessionView
from .notification_views import NotificationListView
from .workspace_views import ActiveWorkspaceSelectionView, WorkspaceListView

app_name = "api"

urlpatterns = [
    path("session/", SessionView.as_view(), name="session"),
    path("session/login/", SessionLoginView.as_view(), name="session-login"),
    path("session/logout/", SessionLogoutView.as_view(), name="session-logout"),
    path("workspaces/", WorkspaceListView.as_view(), name="workspace-list"),
    path("workspaces/active/", ActiveWorkspaceSelectionView.as_view(), name="workspace-active"),
    path("notifications/", NotificationListView.as_view(), name="notification-list"),
]
