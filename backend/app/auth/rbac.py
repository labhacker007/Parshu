from typing import Optional, List
from enum import Enum
from app.models import UserRole


class Permission(str, Enum):
    """Fine-grained permissions for Jyoti - News Feed Aggregator.

    Note: Many permissions are placeholders for future expansion.
    The Jyoti application only uses a subset of these permissions.
    """

    # Articles
    READ_ARTICLES = "read:articles"
    ANALYZE_ARTICLES = "analyze:articles"
    TRIAGE_ARTICLES = "triage:articles"
    ARTICLES_VIEW = "articles:view"
    ARTICLES_VIEW_CONTENT = "articles:view_content"
    ARTICLES_VIEW_DETAILS = "articles:view_details"
    ARTICLES_VIEW_INTELLIGENCE = "articles:view_intelligence"
    ARTICLES_VIEW_HUNTS = "articles:view_hunts"
    ARTICLES_VIEW_COMMENTS = "articles:view_comments"
    ARTICLES_EDIT = "articles:edit"
    ARTICLES_DELETE = "articles:delete"
    ARTICLES_CREATE = "articles:create"
    ARTICLES_ASSIGN = "articles:assign"
    ARTICLES_CHANGE_STATUS = "articles:change_status"
    ARTICLES_ADD_TAGS = "articles:add_tags"
    ARTICLES_ADD_COMMENT = "articles:add_comment"
    ARTICLES_EDIT_COMMENT = "articles:edit_comment"
    ARTICLES_DELETE_COMMENT = "articles:delete_comment"
    ARTICLES_EXPORT = "articles:export"
    ARTICLES_BULK_ACTION = "articles:bulk_action"
    ARTICLES_TRIAGE = "articles:triage"

    # Intelligence (placeholders)
    READ_INTELLIGENCE = "read:intelligence"
    EXTRACT_INTELLIGENCE = "extract:intelligence"
    INTELLIGENCE_VIEW = "intelligence:view"
    INTELLIGENCE_CREATE = "intelligence:create"
    INTELLIGENCE_EDIT = "intelligence:edit"
    INTELLIGENCE_DELETE = "intelligence:delete"
    INTELLIGENCE_EXPORT = "intelligence:export"
    INTELLIGENCE_EXTRACT = "intelligence:extract"
    INTELLIGENCE_ENRICH = "intelligence:enrich"
    INTELLIGENCE_MARK_FALSE_POSITIVE = "intelligence:mark_false_positive"

    # IOCs (placeholders)
    IOC_VIEW = "ioc:view"
    IOC_CREATE = "ioc:create"
    IOC_EDIT = "ioc:edit"
    IOC_DELETE = "ioc:delete"
    IOC_EXPORT = "ioc:export"
    IOC_SEARCH = "ioc:search"
    IOC_ENRICH = "ioc:enrich"
    IOC_VIEW_TIMELINE = "ioc:view_timeline"

    # Sources
    READ_SOURCES = "read:sources"
    MANAGE_SOURCES = "manage:sources"
    SOURCES_VIEW = "sources:view"
    SOURCES_CREATE = "sources:create"
    SOURCES_EDIT = "sources:edit"
    SOURCES_DELETE = "sources:delete"
    SOURCES_ENABLE = "sources:enable"
    SOURCES_DISABLE = "sources:disable"
    SOURCES_TEST = "sources:test"
    SOURCES_INGEST = "sources:ingest"

    # Feed
    FEED_VIEW = "feed:view"
    FEED_READ = "feed:read"
    FEED_SEARCH = "feed:search"
    FEED_FILTER = "feed:filter"
    FEED_STAR = "feed:star"
    FEED_ADD_SOURCE = "feed:add_source"
    FEED_REMOVE_SOURCE = "feed:remove_source"
    FEED_MANAGE_SOURCES = "feed:manage_sources"

    # Watchlist
    MANAGE_GLOBAL_WATCHLIST = "manage:global_watchlist"
    MANAGE_USER_WATCHLIST = "manage:user_watchlist"
    MANAGE_WATCHLISTS = "manage:watchlists"
    WATCHLIST_VIEW = "watchlist:view"
    WATCHLIST_CREATE = "watchlist:create"
    WATCHLIST_EDIT = "watchlist:edit"
    WATCHLIST_DELETE = "watchlist:delete"
    WATCHLIST_IMPORT = "watchlist:import"
    WATCHLIST_EXPORT = "watchlist:export"

    # User Feeds
    MANAGE_USER_FEEDS = "manage:user_feeds"

    # Hunts (placeholders)
    HUNTS_VIEW = "hunts:view"
    HUNTS_CREATE = "hunts:create"
    HUNTS_EDIT = "hunts:edit"
    HUNTS_DELETE = "hunts:delete"
    HUNTS_EXECUTE = "hunts:execute"
    HUNTS_STOP = "hunts:stop"
    HUNTS_SCHEDULE = "hunts:schedule"
    HUNTS_CLONE = "hunts:clone"
    HUNTS_VIEW_RESULTS = "hunts:view_results"
    HUNTS_EXPORT_RESULTS = "hunts:export_results"

    # Reports (placeholders)
    REPORTS_VIEW = "reports:view"
    REPORTS_CREATE = "reports:create"
    REPORTS_EDIT = "reports:edit"
    REPORTS_DELETE = "reports:delete"
    REPORTS_PUBLISH = "reports:publish"
    REPORTS_SHARE = "reports:share"
    REPORTS_EXPORT = "reports:export"
    REPORTS_GENERATE = "reports:generate"
    REPORTS_APPROVE = "reports:approve"
    REPORTS_VIEW_DRAFT = "reports:view_draft"

    # Connectors (placeholders)
    MANAGE_CONNECTORS = "manage:connectors"
    CONNECTORS_VIEW = "connectors:view"
    CONNECTORS_CREATE = "connectors:create"
    CONNECTORS_EDIT = "connectors:edit"
    CONNECTORS_DELETE = "connectors:delete"
    CONNECTORS_ENABLE = "connectors:enable"
    CONNECTORS_DISABLE = "connectors:disable"
    CONNECTORS_TEST = "connectors:test"
    CONNECTORS_VIEW_LOGS = "connectors:view_logs"

    # Audit
    AUDIT_VIEW = "audit:view"
    VIEW_AUDIT_LOGS = "view:audit_logs"
    AUDIT_EXPORT = "audit:export"
    AUDIT_SEARCH = "audit:search"
    AUDIT_VIEW_DETAILS = "audit:view_details"

    # Dashboard
    DASHBOARD_VIEW = "dashboard:view"
    DASHBOARD_VIEW_STATS = "dashboard:view_stats"
    DASHBOARD_VIEW_CHARTS = "dashboard:view_charts"
    DASHBOARD_EXPORT = "dashboard:export"

    # Chatbot (placeholders)
    CHATBOT_USE = "chatbot:use"
    CHATBOT_VIEW_HISTORY = "chatbot:view_history"
    CHATBOT_CLEAR_HISTORY = "chatbot:clear_history"
    CHATBOT_PROVIDE_FEEDBACK = "chatbot:provide_feedback"

    # Admin Users
    MANAGE_USERS = "manage:users"
    MANAGE_RBAC = "manage:rbac"
    ADMIN_USERS_VIEW = "admin:users:view"
    ADMIN_USERS_CREATE = "admin:users:create"
    ADMIN_USERS_EDIT = "admin:users:edit"
    ADMIN_USERS_DELETE = "admin:users:delete"
    ADMIN_USERS_CHANGE_ROLE = "admin:users:change_role"
    ADMIN_USERS_RESET_PASSWORD = "admin:users:reset_password"

    # Admin RBAC
    ADMIN_RBAC_VIEW = "admin:rbac:view"
    ADMIN_RBAC_EDIT_ROLES = "admin:rbac:edit_roles"
    ADMIN_RBAC_EDIT_PERMISSIONS = "admin:rbac:edit_permissions"
    ADMIN_RBAC_USER_OVERRIDES = "admin:rbac:user_overrides"

    # Admin System
    ADMIN_SYSTEM_VIEW = "admin:system:view"
    ADMIN_SYSTEM_EDIT = "admin:system:edit"
    ADMIN_SYSTEM_BACKUP = "admin:system:backup"
    ADMIN_SYSTEM_RESTORE = "admin:system:restore"

    # Admin GenAI
    ADMIN_GENAI_VIEW = "admin:genai:view"
    ADMIN_GENAI_EDIT = "admin:genai:edit"
    ADMIN_GENAI_TEST = "admin:genai:test"
    ADMIN_GENAI_VIEW_LOGS = "admin:genai:view_logs"

    # Admin Guardrails
    ADMIN_GUARDRAILS_VIEW = "admin:guardrails:view"
    ADMIN_GUARDRAILS_EDIT = "admin:guardrails:edit"
    ADMIN_GUARDRAILS_TEST = "admin:guardrails:test"

    # Admin Knowledge Base
    ADMIN_KB_VIEW = "admin:kb:view"
    ADMIN_KB_UPLOAD = "admin:kb:upload"
    ADMIN_KB_DELETE = "admin:kb:delete"
    ADMIN_KB_REPROCESS = "admin:kb:reprocess"

    # General Admin
    ADMIN_ACCESS = "admin:access"


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
