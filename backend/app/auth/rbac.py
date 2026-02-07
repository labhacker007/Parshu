from typing import Optional, List
from enum import Enum
from app.models import UserRole


class Permission(str, Enum):
    """Fine-grained permissions for Jyoti - News Feed Aggregator."""
    # Articles
    READ_ARTICLES = "read:articles"

    # Sources
    READ_SOURCES = "read:sources"
    MANAGE_SOURCES = "manage:sources"  # Admin only

    # Watchlist
    MANAGE_GLOBAL_WATCHLIST = "manage:global_watchlist"  # Admin only
    MANAGE_USER_WATCHLIST = "manage:user_watchlist"  # All users

    # User Feeds
    MANAGE_USER_FEEDS = "manage:user_feeds"  # All users

    # Admin
    MANAGE_USERS = "manage:users"  # Admin only
    VIEW_AUDIT_LOGS = "view:audit_logs"  # Admin only


ROLE_PERMISSIONS = {
    # ADMIN: Full access to all features
    UserRole.ADMIN: [p.value for p in Permission],  # All permissions

    # USER: Standard user with personal feeds and watchlist management
    UserRole.USER: [
        Permission.READ_ARTICLES.value,
        Permission.READ_SOURCES.value,
        Permission.MANAGE_USER_WATCHLIST.value,
        Permission.MANAGE_USER_FEEDS.value,
    ],
}


def get_user_permissions(role: UserRole) -> List[str]:
    """Get all permissions for a user role."""
    return ROLE_PERMISSIONS.get(role, [])


def has_permission(user_role: UserRole, required_permission: str) -> bool:
    """Check if a user role has a specific permission."""
    permissions = get_user_permissions(user_role)
    return required_permission in permissions
