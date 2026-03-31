"""
Comprehensive permission definitions for all application functions.
Maps every action in the system to a permission for granular RBAC control.
"""
from enum import Enum
from typing import Dict, List
from pydantic import BaseModel


class AppPermission(str, Enum):
    """All permissions in the Jyoti platform organized by functional area."""
    
    # =============================================================================
    # DASHBOARD PERMISSIONS
    # =============================================================================
    DASHBOARD_VIEW = "dashboard:view"
    DASHBOARD_VIEW_STATS = "dashboard:view_stats"
    DASHBOARD_VIEW_CHARTS = "dashboard:view_charts"
    DASHBOARD_EXPORT = "dashboard:export"
    
    # =============================================================================
    # NEWS & INTEL FEED PERMISSIONS
    # =============================================================================
    FEED_VIEW = "feed:view"
    FEED_SEARCH = "feed:search"
    FEED_FILTER = "feed:filter"
    FEED_STAR = "feed:star"
    FEED_READ = "feed:read"
    FEED_MANAGE_SOURCES = "feed:manage_sources"
    FEED_ADD_SOURCE = "feed:add_source"
    FEED_REMOVE_SOURCE = "feed:remove_source"
    
    # =============================================================================
    # ARTICLE QUEUE PERMISSIONS
    # =============================================================================
    ARTICLES_VIEW = "articles:view"
    ARTICLES_VIEW_DETAILS = "articles:view_details"
    ARTICLES_CREATE = "articles:create"
    ARTICLES_EDIT = "articles:edit"
    ARTICLES_DELETE = "articles:delete"
    ARTICLES_ASSIGN = "articles:assign"
    ARTICLES_TRIAGE = "articles:triage"
    ARTICLES_CHANGE_STATUS = "articles:change_status"
    ARTICLES_ADD_TAGS = "articles:add_tags"
    ARTICLES_EXPORT = "articles:export"
    ARTICLES_BULK_ACTION = "articles:bulk_action"
    
    # Article Detail Tabs
    ARTICLES_VIEW_CONTENT = "articles:view_content"
    ARTICLES_VIEW_INTELLIGENCE = "articles:view_intelligence"
    ARTICLES_VIEW_HUNTS = "articles:view_hunts"
    ARTICLES_VIEW_COMMENTS = "articles:view_comments"
    ARTICLES_ADD_COMMENT = "articles:add_comment"
    ARTICLES_EDIT_COMMENT = "articles:edit_comment"
    ARTICLES_DELETE_COMMENT = "articles:delete_comment"
    
    # =============================================================================
    # INTELLIGENCE & IOC PERMISSIONS
    # =============================================================================
    INTELLIGENCE_VIEW = "intelligence:view"
    INTELLIGENCE_CREATE = "intelligence:create"
    INTELLIGENCE_EDIT = "intelligence:edit"
    INTELLIGENCE_DELETE = "intelligence:delete"
    INTELLIGENCE_EXTRACT = "intelligence:extract"
    INTELLIGENCE_EXPORT = "intelligence:export"
    INTELLIGENCE_ENRICH = "intelligence:enrich"
    INTELLIGENCE_MARK_FALSE_POSITIVE = "intelligence:mark_false_positive"
    
    # IOC Management
    IOC_VIEW = "ioc:view"
    IOC_CREATE = "ioc:create"
    IOC_EDIT = "ioc:edit"
    IOC_DELETE = "ioc:delete"
    IOC_EXPORT = "ioc:export"
    IOC_ENRICH = "ioc:enrich"
    IOC_SEARCH = "ioc:search"
    IOC_VIEW_TIMELINE = "ioc:view_timeline"
    
    # =============================================================================
    # THREAT HUNTING PERMISSIONS
    # =============================================================================
    HUNTS_VIEW = "hunts:view"
    HUNTS_CREATE = "hunts:create"
    HUNTS_EDIT = "hunts:edit"
    HUNTS_DELETE = "hunts:delete"
    HUNTS_EXECUTE = "hunts:execute"
    HUNTS_STOP = "hunts:stop"
    HUNTS_VIEW_RESULTS = "hunts:view_results"
    HUNTS_EXPORT_RESULTS = "hunts:export_results"
    HUNTS_SCHEDULE = "hunts:schedule"
    HUNTS_CLONE = "hunts:clone"
    
    # =============================================================================
    # REPORTS PERMISSIONS
    # =============================================================================
    REPORTS_VIEW = "reports:view"
    REPORTS_CREATE = "reports:create"
    REPORTS_EDIT = "reports:edit"
    REPORTS_DELETE = "reports:delete"
    REPORTS_GENERATE = "reports:generate"
    REPORTS_PUBLISH = "reports:publish"
    REPORTS_SHARE = "reports:share"
    REPORTS_EXPORT = "reports:export"
    REPORTS_VIEW_DRAFT = "reports:view_draft"
    REPORTS_APPROVE = "reports:approve"
    
    # =============================================================================
    # ANALYTICS & KPI PERMISSIONS
    # =============================================================================
    ANALYTICS_VIEW = "analytics:view"
    ANALYTICS_VIEW_DASHBOARD = "analytics:view_dashboard"
    ANALYTICS_VIEW_KPIS = "analytics:view_kpis"
    ANALYTICS_VIEW_SLAS = "analytics:view_slas"
    ANALYTICS_VIEW_ROI = "analytics:view_roi"
    ANALYTICS_GENERATE_REPORT = "analytics:generate_report"
    ANALYTICS_EXPORT = "analytics:export"
    ANALYTICS_CONFIGURE = "analytics:configure"
    
    # =============================================================================
    # CONNECTORS PERMISSIONS
    # =============================================================================
    CONNECTORS_VIEW = "connectors:view"
    CONNECTORS_CREATE = "connectors:create"
    CONNECTORS_EDIT = "connectors:edit"
    CONNECTORS_DELETE = "connectors:delete"
    CONNECTORS_TEST = "connectors:test"
    CONNECTORS_ENABLE = "connectors:enable"
    CONNECTORS_DISABLE = "connectors:disable"
    CONNECTORS_VIEW_LOGS = "connectors:view_logs"
    
    # =============================================================================
    # FEED SOURCES PERMISSIONS
    # =============================================================================
    SOURCES_VIEW = "sources:view"
    SOURCES_CREATE = "sources:create"
    SOURCES_EDIT = "sources:edit"
    SOURCES_DELETE = "sources:delete"
    SOURCES_ENABLE = "sources:enable"
    SOURCES_DISABLE = "sources:disable"
    SOURCES_TEST = "sources:test"
    SOURCES_INGEST = "sources:ingest"
    
    # =============================================================================
    # WATCHLIST PERMISSIONS
    # =============================================================================
    WATCHLIST_VIEW = "watchlist:view"
    WATCHLIST_CREATE = "watchlist:create"
    WATCHLIST_EDIT = "watchlist:edit"
    WATCHLIST_DELETE = "watchlist:delete"
    WATCHLIST_IMPORT = "watchlist:import"
    WATCHLIST_EXPORT = "watchlist:export"
    
    # =============================================================================
    # CHATBOT / AI ASSISTANT PERMISSIONS
    # =============================================================================
    CHATBOT_USE = "chatbot:use"
    CHATBOT_VIEW_HISTORY = "chatbot:view_history"
    CHATBOT_CLEAR_HISTORY = "chatbot:clear_history"
    CHATBOT_PROVIDE_FEEDBACK = "chatbot:provide_feedback"
    
    # =============================================================================
    # AUDIT LOG PERMISSIONS
    # =============================================================================
    AUDIT_VIEW = "audit:view"
    AUDIT_EXPORT = "audit:export"
    AUDIT_SEARCH = "audit:search"
    AUDIT_VIEW_DETAILS = "audit:view_details"
    
    # =============================================================================
    # ADMIN PORTAL PERMISSIONS
    # =============================================================================
    ADMIN_ACCESS = "admin:access"
    
    # User Management
    ADMIN_USERS_VIEW = "admin:users:view"
    ADMIN_USERS_CREATE = "admin:users:create"
    ADMIN_USERS_EDIT = "admin:users:edit"
    ADMIN_USERS_DELETE = "admin:users:delete"
    ADMIN_USERS_RESET_PASSWORD = "admin:users:reset_password"
    ADMIN_USERS_CHANGE_ROLE = "admin:users:change_role"
    
    # System Configuration
    ADMIN_SYSTEM_VIEW = "admin:system:view"
    ADMIN_SYSTEM_EDIT = "admin:system:edit"
    ADMIN_SYSTEM_BACKUP = "admin:system:backup"
    ADMIN_SYSTEM_RESTORE = "admin:system:restore"
    
    # GenAI Management
    ADMIN_GENAI_VIEW = "admin:genai:view"
    ADMIN_GENAI_EDIT = "admin:genai:edit"
    ADMIN_GENAI_TEST = "admin:genai:test"
    ADMIN_GENAI_VIEW_LOGS = "admin:genai:view_logs"
    
    # Knowledge Base Management
    ADMIN_KB_VIEW = "admin:kb:view"
    ADMIN_KB_UPLOAD = "admin:kb:upload"
    ADMIN_KB_DELETE = "admin:kb:delete"
    ADMIN_KB_REPROCESS = "admin:kb:reprocess"
    
    # RBAC Management
    ADMIN_RBAC_VIEW = "admin:rbac:view"
    ADMIN_RBAC_EDIT_ROLES = "admin:rbac:edit_roles"
    ADMIN_RBAC_EDIT_PERMISSIONS = "admin:rbac:edit_permissions"
    ADMIN_RBAC_USER_OVERRIDES = "admin:rbac:user_overrides"
    
    # Guardrails Management
    ADMIN_GUARDRAILS_VIEW = "admin:guardrails:view"
    ADMIN_GUARDRAILS_EDIT = "admin:guardrails:edit"
    ADMIN_GUARDRAILS_TEST = "admin:guardrails:test"


class FunctionalArea(BaseModel):
    """Represents a functional area of the application."""
    key: str
    name: str
    description: str
    permissions: List[str]
    default_roles: List[str]


# Complete functional area mapping
FUNCTIONAL_AREAS: Dict[str, FunctionalArea] = {
    "dashboard": FunctionalArea(
        key="dashboard",
        name="Dashboard",
        description="Main dashboard and overview statistics",
        permissions=[
            AppPermission.DASHBOARD_VIEW.value,
            AppPermission.DASHBOARD_VIEW_STATS.value,
            AppPermission.DASHBOARD_VIEW_CHARTS.value,
            AppPermission.DASHBOARD_EXPORT.value,
        ],
        default_roles=["ADMIN", "TI", "TH", "IR", "VIEWER"]
    ),
    "feed": FunctionalArea(
        key="feed",
        name="News & Intel Feed",
        description="Intelligence feed and news reader",
        permissions=[
            AppPermission.FEED_VIEW.value,
            AppPermission.FEED_SEARCH.value,
            AppPermission.FEED_FILTER.value,
            AppPermission.FEED_STAR.value,
            AppPermission.FEED_READ.value,
            AppPermission.FEED_MANAGE_SOURCES.value,
            AppPermission.FEED_ADD_SOURCE.value,
            AppPermission.FEED_REMOVE_SOURCE.value,
        ],
        default_roles=["ADMIN", "TI", "TH", "IR", "VIEWER"]
    ),
    "articles": FunctionalArea(
        key="articles",
        name="Article Queue",
        description="Article triage and management",
        permissions=[
            AppPermission.ARTICLES_VIEW.value,
            AppPermission.ARTICLES_VIEW_DETAILS.value,
            AppPermission.ARTICLES_CREATE.value,
            AppPermission.ARTICLES_EDIT.value,
            AppPermission.ARTICLES_DELETE.value,
            AppPermission.ARTICLES_ASSIGN.value,
            AppPermission.ARTICLES_TRIAGE.value,
            AppPermission.ARTICLES_CHANGE_STATUS.value,
            AppPermission.ARTICLES_ADD_TAGS.value,
            AppPermission.ARTICLES_EXPORT.value,
            AppPermission.ARTICLES_BULK_ACTION.value,
            AppPermission.ARTICLES_VIEW_CONTENT.value,
            AppPermission.ARTICLES_VIEW_INTELLIGENCE.value,
            AppPermission.ARTICLES_VIEW_HUNTS.value,
            AppPermission.ARTICLES_VIEW_COMMENTS.value,
            AppPermission.ARTICLES_ADD_COMMENT.value,
            AppPermission.ARTICLES_EDIT_COMMENT.value,
            AppPermission.ARTICLES_DELETE_COMMENT.value,
        ],
        default_roles=["ADMIN", "TI", "TH", "IR"]
    ),
    "intelligence": FunctionalArea(
        key="intelligence",
        name="Intelligence & IOCs",
        description="Intelligence extraction and IOC management",
        permissions=[
            AppPermission.INTELLIGENCE_VIEW.value,
            AppPermission.INTELLIGENCE_CREATE.value,
            AppPermission.INTELLIGENCE_EDIT.value,
            AppPermission.INTELLIGENCE_DELETE.value,
            AppPermission.INTELLIGENCE_EXTRACT.value,
            AppPermission.INTELLIGENCE_EXPORT.value,
            AppPermission.INTELLIGENCE_ENRICH.value,
            AppPermission.INTELLIGENCE_MARK_FALSE_POSITIVE.value,
            AppPermission.IOC_VIEW.value,
            AppPermission.IOC_CREATE.value,
            AppPermission.IOC_EDIT.value,
            AppPermission.IOC_DELETE.value,
            AppPermission.IOC_EXPORT.value,
            AppPermission.IOC_ENRICH.value,
            AppPermission.IOC_SEARCH.value,
            AppPermission.IOC_VIEW_TIMELINE.value,
        ],
        default_roles=["ADMIN", "TI", "TH", "IR"]
    ),
    "hunts": FunctionalArea(
        key="hunts",
        name="Threat Hunting",
        description="Threat hunt operations and management",
        permissions=[
            AppPermission.HUNTS_VIEW.value,
            AppPermission.HUNTS_CREATE.value,
            AppPermission.HUNTS_EDIT.value,
            AppPermission.HUNTS_DELETE.value,
            AppPermission.HUNTS_EXECUTE.value,
            AppPermission.HUNTS_STOP.value,
            AppPermission.HUNTS_VIEW_RESULTS.value,
            AppPermission.HUNTS_EXPORT_RESULTS.value,
            AppPermission.HUNTS_SCHEDULE.value,
            AppPermission.HUNTS_CLONE.value,
        ],
        default_roles=["ADMIN", "TH"]
    ),
    "reports": FunctionalArea(
        key="reports",
        name="Reports",
        description="Report generation and management",
        permissions=[
            AppPermission.REPORTS_VIEW.value,
            AppPermission.REPORTS_CREATE.value,
            AppPermission.REPORTS_EDIT.value,
            AppPermission.REPORTS_DELETE.value,
            AppPermission.REPORTS_GENERATE.value,
            AppPermission.REPORTS_PUBLISH.value,
            AppPermission.REPORTS_SHARE.value,
            AppPermission.REPORTS_EXPORT.value,
            AppPermission.REPORTS_VIEW_DRAFT.value,
            AppPermission.REPORTS_APPROVE.value,
        ],
        default_roles=["ADMIN", "TI", "MANAGER", "EXECUTIVE"]
    ),
    "connectors": FunctionalArea(
        key="connectors",
        name="Connectors",
        description="Integration connector management",
        permissions=[
            AppPermission.CONNECTORS_VIEW.value,
            AppPermission.CONNECTORS_CREATE.value,
            AppPermission.CONNECTORS_EDIT.value,
            AppPermission.CONNECTORS_DELETE.value,
            AppPermission.CONNECTORS_TEST.value,
            AppPermission.CONNECTORS_ENABLE.value,
            AppPermission.CONNECTORS_DISABLE.value,
            AppPermission.CONNECTORS_VIEW_LOGS.value,
        ],
        default_roles=["ADMIN"]
    ),
    "sources": FunctionalArea(
        key="sources",
        name="Feed Sources",
        description="RSS/API feed source management",
        permissions=[
            AppPermission.SOURCES_VIEW.value,
            AppPermission.SOURCES_CREATE.value,
            AppPermission.SOURCES_EDIT.value,
            AppPermission.SOURCES_DELETE.value,
            AppPermission.SOURCES_ENABLE.value,
            AppPermission.SOURCES_DISABLE.value,
            AppPermission.SOURCES_TEST.value,
            AppPermission.SOURCES_INGEST.value,
        ],
        default_roles=["ADMIN", "TI"]
    ),
    "watchlist": FunctionalArea(
        key="watchlist",
        name="Watchlist",
        description="Keyword watchlist management",
        permissions=[
            AppPermission.WATCHLIST_VIEW.value,
            AppPermission.WATCHLIST_CREATE.value,
            AppPermission.WATCHLIST_EDIT.value,
            AppPermission.WATCHLIST_DELETE.value,
            AppPermission.WATCHLIST_IMPORT.value,
            AppPermission.WATCHLIST_EXPORT.value,
        ],
        default_roles=["ADMIN", "TI"]
    ),
    "chatbot": FunctionalArea(
        key="chatbot",
        name="AI Assistant",
        description="Jyoti AI chatbot assistant",
        permissions=[
            AppPermission.CHATBOT_USE.value,
            AppPermission.CHATBOT_VIEW_HISTORY.value,
            AppPermission.CHATBOT_CLEAR_HISTORY.value,
            AppPermission.CHATBOT_PROVIDE_FEEDBACK.value,
        ],
        default_roles=["ADMIN", "TI", "TH", "IR", "VIEWER"]
    ),
    "audit": FunctionalArea(
        key="audit",
        name="Audit Logs",
        description="System audit trail and logs",
        permissions=[
            AppPermission.AUDIT_VIEW.value,
            AppPermission.AUDIT_EXPORT.value,
            AppPermission.AUDIT_SEARCH.value,
            AppPermission.AUDIT_VIEW_DETAILS.value,
        ],
        default_roles=["ADMIN"]
    ),
    "admin": FunctionalArea(
        key="admin",
        name="Admin Portal",
        description="System administration and configuration",
        permissions=[
            AppPermission.ADMIN_ACCESS.value,
            AppPermission.ADMIN_USERS_VIEW.value,
            AppPermission.ADMIN_USERS_CREATE.value,
            AppPermission.ADMIN_USERS_EDIT.value,
            AppPermission.ADMIN_USERS_DELETE.value,
            AppPermission.ADMIN_USERS_RESET_PASSWORD.value,
            AppPermission.ADMIN_USERS_CHANGE_ROLE.value,
            AppPermission.ADMIN_SYSTEM_VIEW.value,
            AppPermission.ADMIN_SYSTEM_EDIT.value,
            AppPermission.ADMIN_SYSTEM_BACKUP.value,
            AppPermission.ADMIN_SYSTEM_RESTORE.value,
            AppPermission.ADMIN_GENAI_VIEW.value,
            AppPermission.ADMIN_GENAI_EDIT.value,
            AppPermission.ADMIN_GENAI_TEST.value,
            AppPermission.ADMIN_GENAI_VIEW_LOGS.value,
            AppPermission.ADMIN_KB_VIEW.value,
            AppPermission.ADMIN_KB_UPLOAD.value,
            AppPermission.ADMIN_KB_DELETE.value,
            AppPermission.ADMIN_KB_REPROCESS.value,
            AppPermission.ADMIN_RBAC_VIEW.value,
            AppPermission.ADMIN_RBAC_EDIT_ROLES.value,
            AppPermission.ADMIN_RBAC_EDIT_PERMISSIONS.value,
            AppPermission.ADMIN_RBAC_USER_OVERRIDES.value,
            AppPermission.ADMIN_GUARDRAILS_VIEW.value,
            AppPermission.ADMIN_GUARDRAILS_EDIT.value,
            AppPermission.ADMIN_GUARDRAILS_TEST.value,
        ],
        default_roles=["ADMIN"]
    ),
}


# Default role permissions (comprehensive)
DEFAULT_ROLE_PERMISSIONS = {
    "ADMIN": [p.value for p in AppPermission],  # All permissions
    
    "TI": [
        # Dashboard
        AppPermission.DASHBOARD_VIEW.value,
        AppPermission.DASHBOARD_VIEW_STATS.value,
        AppPermission.DASHBOARD_VIEW_CHARTS.value,
        AppPermission.DASHBOARD_EXPORT.value,
        # Feed
        AppPermission.FEED_VIEW.value,
        AppPermission.FEED_SEARCH.value,
        AppPermission.FEED_FILTER.value,
        AppPermission.FEED_STAR.value,
        AppPermission.FEED_READ.value,
        AppPermission.FEED_MANAGE_SOURCES.value,
        AppPermission.FEED_ADD_SOURCE.value,
        # Articles - Full control
        AppPermission.ARTICLES_VIEW.value,
        AppPermission.ARTICLES_VIEW_DETAILS.value,
        AppPermission.ARTICLES_EDIT.value,
        AppPermission.ARTICLES_TRIAGE.value,
        AppPermission.ARTICLES_ASSIGN.value,
        AppPermission.ARTICLES_CHANGE_STATUS.value,
        AppPermission.ARTICLES_ADD_TAGS.value,
        AppPermission.ARTICLES_EXPORT.value,
        AppPermission.ARTICLES_VIEW_CONTENT.value,
        AppPermission.ARTICLES_VIEW_INTELLIGENCE.value,
        AppPermission.ARTICLES_VIEW_HUNTS.value,
        AppPermission.ARTICLES_VIEW_COMMENTS.value,
        AppPermission.ARTICLES_ADD_COMMENT.value,
        # Intelligence - Full control
        AppPermission.INTELLIGENCE_VIEW.value,
        AppPermission.INTELLIGENCE_CREATE.value,
        AppPermission.INTELLIGENCE_EDIT.value,
        AppPermission.INTELLIGENCE_EXTRACT.value,
        AppPermission.INTELLIGENCE_EXPORT.value,
        AppPermission.INTELLIGENCE_ENRICH.value,
        AppPermission.INTELLIGENCE_MARK_FALSE_POSITIVE.value,
        AppPermission.IOC_VIEW.value,
        AppPermission.IOC_CREATE.value,
        AppPermission.IOC_EDIT.value,
        AppPermission.IOC_EXPORT.value,
        AppPermission.IOC_SEARCH.value,
        AppPermission.IOC_VIEW_TIMELINE.value,
        # Hunts - View only
        AppPermission.HUNTS_VIEW.value,
        AppPermission.HUNTS_CREATE.value,
        AppPermission.HUNTS_VIEW_RESULTS.value,
        # Reports - Full control
        AppPermission.REPORTS_VIEW.value,
        AppPermission.REPORTS_CREATE.value,
        AppPermission.REPORTS_EDIT.value,
        AppPermission.REPORTS_GENERATE.value,
        AppPermission.REPORTS_PUBLISH.value,
        AppPermission.REPORTS_SHARE.value,
        AppPermission.REPORTS_EXPORT.value,
        AppPermission.REPORTS_VIEW_DRAFT.value,
        # Sources
        AppPermission.SOURCES_VIEW.value,
        AppPermission.SOURCES_CREATE.value,
        AppPermission.SOURCES_EDIT.value,
        # Watchlist
        AppPermission.WATCHLIST_VIEW.value,
        AppPermission.WATCHLIST_CREATE.value,
        AppPermission.WATCHLIST_EDIT.value,
        # Chatbot
        AppPermission.CHATBOT_USE.value,
        AppPermission.CHATBOT_VIEW_HISTORY.value,
    ],
    
    "TH": [
        # Dashboard
        AppPermission.DASHBOARD_VIEW.value,
        AppPermission.DASHBOARD_VIEW_STATS.value,
        AppPermission.DASHBOARD_VIEW_CHARTS.value,
        # Feed
        AppPermission.FEED_VIEW.value,
        AppPermission.FEED_SEARCH.value,
        AppPermission.FEED_FILTER.value,
        AppPermission.FEED_READ.value,
        # Articles - View only
        AppPermission.ARTICLES_VIEW.value,
        AppPermission.ARTICLES_VIEW_DETAILS.value,
        AppPermission.ARTICLES_VIEW_CONTENT.value,
        AppPermission.ARTICLES_VIEW_INTELLIGENCE.value,
        AppPermission.ARTICLES_VIEW_HUNTS.value,
        # Intelligence - View only
        AppPermission.INTELLIGENCE_VIEW.value,
        AppPermission.INTELLIGENCE_EXPORT.value,
        AppPermission.IOC_VIEW.value,
        AppPermission.IOC_SEARCH.value,
        # Hunts - Full control
        AppPermission.HUNTS_VIEW.value,
        AppPermission.HUNTS_CREATE.value,
        AppPermission.HUNTS_EDIT.value,
        AppPermission.HUNTS_DELETE.value,
        AppPermission.HUNTS_EXECUTE.value,
        AppPermission.HUNTS_STOP.value,
        AppPermission.HUNTS_VIEW_RESULTS.value,
        AppPermission.HUNTS_EXPORT_RESULTS.value,
        AppPermission.HUNTS_SCHEDULE.value,
        AppPermission.HUNTS_CLONE.value,
        # Reports - View only
        AppPermission.REPORTS_VIEW.value,
        AppPermission.REPORTS_EXPORT.value,
        # Chatbot
        AppPermission.CHATBOT_USE.value,
    ],
    
    "IR": [
        # Dashboard
        AppPermission.DASHBOARD_VIEW.value,
        AppPermission.DASHBOARD_VIEW_STATS.value,
        # Feed
        AppPermission.FEED_VIEW.value,
        AppPermission.FEED_SEARCH.value,
        AppPermission.FEED_READ.value,
        # Articles
        AppPermission.ARTICLES_VIEW.value,
        AppPermission.ARTICLES_VIEW_DETAILS.value,
        AppPermission.ARTICLES_TRIAGE.value,
        AppPermission.ARTICLES_VIEW_CONTENT.value,
        AppPermission.ARTICLES_VIEW_INTELLIGENCE.value,
        AppPermission.ARTICLES_VIEW_COMMENTS.value,
        AppPermission.ARTICLES_ADD_COMMENT.value,
        # Intelligence - View only
        AppPermission.INTELLIGENCE_VIEW.value,
        AppPermission.IOC_VIEW.value,
        AppPermission.IOC_SEARCH.value,
        # Hunts - Execute only
        AppPermission.HUNTS_VIEW.value,
        AppPermission.HUNTS_EXECUTE.value,
        AppPermission.HUNTS_VIEW_RESULTS.value,
        # Reports
        AppPermission.REPORTS_VIEW.value,
        AppPermission.REPORTS_SHARE.value,
        # Chatbot
        AppPermission.CHATBOT_USE.value,
    ],
    
    "VIEWER": [
        # Dashboard
        AppPermission.DASHBOARD_VIEW.value,
        AppPermission.DASHBOARD_VIEW_STATS.value,
        # Feed
        AppPermission.FEED_VIEW.value,
        AppPermission.FEED_READ.value,
        # Articles - View only
        AppPermission.ARTICLES_VIEW.value,
        AppPermission.ARTICLES_VIEW_DETAILS.value,
        AppPermission.ARTICLES_VIEW_CONTENT.value,
        # Intelligence - View only
        AppPermission.INTELLIGENCE_VIEW.value,
        AppPermission.IOC_VIEW.value,
        # Hunts - View only
        AppPermission.HUNTS_VIEW.value,
        AppPermission.HUNTS_VIEW_RESULTS.value,
        # Reports - View only
        AppPermission.REPORTS_VIEW.value,
        # Chatbot
        AppPermission.CHATBOT_USE.value,
    ],
    
    # EXECUTIVE - C-Suite/CISO: Read-only access to dashboards and reports
    "EXECUTIVE": [
        # Dashboard - Full view access
        AppPermission.DASHBOARD_VIEW.value,
        AppPermission.DASHBOARD_VIEW_STATS.value,
        AppPermission.DASHBOARD_VIEW_CHARTS.value,
        AppPermission.DASHBOARD_EXPORT.value,
        # Articles - High-level view
        AppPermission.ARTICLES_VIEW.value,
        AppPermission.ARTICLES_VIEW_DETAILS.value,
        # Intelligence - Summary view
        AppPermission.INTELLIGENCE_VIEW.value,
        # Hunts - View results only
        AppPermission.HUNTS_VIEW.value,
        AppPermission.HUNTS_VIEW_RESULTS.value,
        # Reports - Full access to view, export, share
        AppPermission.REPORTS_VIEW.value,
        AppPermission.REPORTS_EXPORT.value,
        AppPermission.REPORTS_SHARE.value,
        AppPermission.REPORTS_VIEW_DRAFT.value,
        # Audit - View for compliance
        AppPermission.AUDIT_VIEW.value,
        AppPermission.AUDIT_EXPORT.value,
        # Chatbot
        AppPermission.CHATBOT_USE.value,
    ],
    
    # MANAGER - Team leads: Reports, metrics, team oversight
    "MANAGER": [
        # Dashboard - Full access
        AppPermission.DASHBOARD_VIEW.value,
        AppPermission.DASHBOARD_VIEW_STATS.value,
        AppPermission.DASHBOARD_VIEW_CHARTS.value,
        AppPermission.DASHBOARD_EXPORT.value,
        # Feed - View
        AppPermission.FEED_VIEW.value,
        AppPermission.FEED_SEARCH.value,
        AppPermission.FEED_FILTER.value,
        AppPermission.FEED_READ.value,
        # Articles - View and assign
        AppPermission.ARTICLES_VIEW.value,
        AppPermission.ARTICLES_VIEW_DETAILS.value,
        AppPermission.ARTICLES_ASSIGN.value,
        AppPermission.ARTICLES_VIEW_CONTENT.value,
        AppPermission.ARTICLES_VIEW_INTELLIGENCE.value,
        AppPermission.ARTICLES_VIEW_HUNTS.value,
        AppPermission.ARTICLES_VIEW_COMMENTS.value,
        AppPermission.ARTICLES_EXPORT.value,
        # Intelligence - View and export
        AppPermission.INTELLIGENCE_VIEW.value,
        AppPermission.INTELLIGENCE_EXPORT.value,
        AppPermission.IOC_VIEW.value,
        AppPermission.IOC_EXPORT.value,
        AppPermission.IOC_SEARCH.value,
        # Hunts - View and manage schedules
        AppPermission.HUNTS_VIEW.value,
        AppPermission.HUNTS_VIEW_RESULTS.value,
        AppPermission.HUNTS_EXPORT_RESULTS.value,
        AppPermission.HUNTS_SCHEDULE.value,
        # Reports - Full management
        AppPermission.REPORTS_VIEW.value,
        AppPermission.REPORTS_CREATE.value,
        AppPermission.REPORTS_EDIT.value,
        AppPermission.REPORTS_GENERATE.value,
        AppPermission.REPORTS_PUBLISH.value,
        AppPermission.REPORTS_SHARE.value,
        AppPermission.REPORTS_EXPORT.value,
        AppPermission.REPORTS_VIEW_DRAFT.value,
        AppPermission.REPORTS_APPROVE.value,
        # Audit - View for team oversight
        AppPermission.AUDIT_VIEW.value,
        AppPermission.AUDIT_EXPORT.value,
        AppPermission.AUDIT_SEARCH.value,
        # Chatbot
        AppPermission.CHATBOT_USE.value,
        AppPermission.CHATBOT_VIEW_HISTORY.value,
    ],
}


def get_all_permissions() -> List[Dict]:
    """Get all permissions grouped by functional area."""
    result = []
    for area_key, area in FUNCTIONAL_AREAS.items():
        for perm in area.permissions:
            result.append({
                "key": perm,
                "name": perm.split(":")[-1].replace("_", " ").title(),
                "description": f"{area.name}: {perm.split(':')[-1].replace('_', ' ').title()}",
                "category": area.name,
                "area": area_key
            })
    return result


def get_permissions_by_area(area_key: str) -> List[str]:
    """Get all permissions for a functional area."""
    if area_key in FUNCTIONAL_AREAS:
        return FUNCTIONAL_AREAS[area_key].permissions
    return []


def get_all_functional_areas() -> List[Dict]:
    """Get all functional areas."""
    return [area.dict() for area in FUNCTIONAL_AREAS.values()]
