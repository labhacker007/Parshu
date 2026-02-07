"""Page and tab-level permission definitions for RBAC."""
from enum import Enum
from typing import Dict, List, Optional
from pydantic import BaseModel


class PagePermission(str, Enum):
    """Page-level permissions."""
    # Dashboard
    VIEW_DASHBOARD = "page:dashboard:view"
    
    # Intel & News Feed
    VIEW_FEED = "page:feed:view"
    MANAGE_FEED_SOURCES = "page:feed:manage_sources"
    
    # Articles / Article Queue
    VIEW_ARTICLES = "page:articles:view"
    EDIT_ARTICLES = "page:articles:edit"
    DELETE_ARTICLES = "page:articles:delete"
    ASSIGN_ARTICLES = "page:articles:assign"
    TRIAGE_ARTICLES = "page:articles:triage"
    
    # Article Detail Tabs
    VIEW_ARTICLE_CONTENT = "page:article_detail:content"
    VIEW_ARTICLE_INTELLIGENCE = "page:article_detail:intelligence"
    VIEW_ARTICLE_HUNTS = "page:article_detail:hunts"
    VIEW_ARTICLE_COMMENTS = "page:article_detail:comments"
    EDIT_ARTICLE_INTELLIGENCE = "page:article_detail:edit_intelligence"
    DELETE_ARTICLE_INTELLIGENCE = "page:article_detail:delete_intelligence"
    
    # Intelligence View
    VIEW_INTELLIGENCE = "page:intelligence:view"
    EDIT_INTELLIGENCE = "page:intelligence:edit"
    DELETE_INTELLIGENCE = "page:intelligence:delete"
    EXPORT_INTELLIGENCE = "page:intelligence:export"
    
    # Threat Hunting
    VIEW_HUNTS = "page:hunts:view"
    CREATE_HUNTS = "page:hunts:create"
    EXECUTE_HUNTS = "page:hunts:execute"
    EDIT_HUNTS = "page:hunts:edit"
    DELETE_HUNTS = "page:hunts:delete"
    VIEW_HUNT_RESULTS = "page:hunts:view_results"
    
    # Reports
    VIEW_REPORTS = "page:reports:view"
    CREATE_REPORTS = "page:reports:create"
    EDIT_REPORTS = "page:reports:edit"
    DELETE_REPORTS = "page:reports:delete"
    PUBLISH_REPORTS = "page:reports:publish"
    SHARE_REPORTS = "page:reports:share"
    EXPORT_REPORTS = "page:reports:export"
    
    # Connectors
    VIEW_CONNECTORS = "page:connectors:view"
    MANAGE_CONNECTORS = "page:connectors:manage"
    TEST_CONNECTORS = "page:connectors:test"
    
    # Feed Sources
    VIEW_SOURCES = "page:sources:view"
    MANAGE_SOURCES = "page:sources:manage"
    
    # Watchlist
    VIEW_WATCHLIST = "page:watchlist:view"
    MANAGE_WATCHLIST = "page:watchlist:manage"
    
    # Audit Logs
    VIEW_AUDIT = "page:audit:view"
    EXPORT_AUDIT = "page:audit:export"
    
    # Admin Portal
    VIEW_ADMIN = "page:admin:view"
    MANAGE_USERS = "page:admin:manage_users"
    MANAGE_SYSTEM = "page:admin:manage_system"
    MANAGE_GENAI = "page:admin:manage_genai"
    MANAGE_KNOWLEDGE = "page:admin:manage_knowledge"
    MANAGE_RBAC = "page:admin:manage_rbac"
    
    # Chatbot
    USE_CHATBOT = "page:chatbot:use"
    VIEW_CHATBOT_HISTORY = "page:chatbot:view_history"


class PageDefinition(BaseModel):
    """Definition of a page with its permissions."""
    page_key: str
    page_name: str
    page_path: str
    description: str
    category: str
    permissions: List[str]
    default_roles: List[str]  # Roles that have access by default


# Page definitions with their permissions
PAGE_DEFINITIONS: Dict[str, PageDefinition] = {
    "dashboard": PageDefinition(
        page_key="dashboard",
        page_name="Dashboard",
        page_path="/dashboard",
        description="Main overview dashboard",
        category="Overview",
        permissions=[PagePermission.VIEW_DASHBOARD.value],
        default_roles=["ADMIN", "EXECUTIVE", "MANAGER", "TI", "TH", "IR", "VIEWER"]
    ),
    "feed": PageDefinition(
        page_key="feed",
        page_name="Intel & News",
        page_path="/feed",
        description="Intelligence feed and news reader",
        category="Intelligence",
        permissions=[
            PagePermission.VIEW_FEED.value,
            PagePermission.MANAGE_FEED_SOURCES.value
        ],
        default_roles=["ADMIN", "EXECUTIVE", "MANAGER", "TI", "TH", "IR", "VIEWER"]
    ),
    "articles": PageDefinition(
        page_key="articles",
        page_name="Article Queue",
        page_path="/articles",
        description="Article triage and management",
        category="Intelligence",
        permissions=[
            PagePermission.VIEW_ARTICLES.value,
            PagePermission.EDIT_ARTICLES.value,
            PagePermission.DELETE_ARTICLES.value,
            PagePermission.ASSIGN_ARTICLES.value,
            PagePermission.TRIAGE_ARTICLES.value
        ],
        default_roles=["ADMIN", "EXECUTIVE", "MANAGER", "TI", "TH", "IR"]
    ),
    "article_detail": PageDefinition(
        page_key="article_detail",
        page_name="Article Detail",
        page_path="/articles/:id",
        description="Detailed article view with tabs",
        category="Intelligence",
        permissions=[
            PagePermission.VIEW_ARTICLE_CONTENT.value,
            PagePermission.VIEW_ARTICLE_INTELLIGENCE.value,
            PagePermission.VIEW_ARTICLE_HUNTS.value,
            PagePermission.VIEW_ARTICLE_COMMENTS.value,
            PagePermission.EDIT_ARTICLE_INTELLIGENCE.value,
            PagePermission.DELETE_ARTICLE_INTELLIGENCE.value
        ],
        default_roles=["ADMIN", "TI", "TH", "IR"]
    ),
    "intelligence": PageDefinition(
        page_key="intelligence",
        page_name="Intelligence View",
        page_path="/intelligence",
        description="Global intelligence and IOC management",
        category="Intelligence",
        permissions=[
            PagePermission.VIEW_INTELLIGENCE.value,
            PagePermission.EDIT_INTELLIGENCE.value,
            PagePermission.DELETE_INTELLIGENCE.value,
            PagePermission.EXPORT_INTELLIGENCE.value
        ],
        default_roles=["ADMIN", "EXECUTIVE", "MANAGER", "TI", "TH", "IR"]
    ),
    "hunts": PageDefinition(
        page_key="hunts",
        page_name="Threat Hunting",
        page_path="/hunts",
        description="Threat hunt workbench",
        category="Hunting",
        permissions=[
            PagePermission.VIEW_HUNTS.value,
            PagePermission.CREATE_HUNTS.value,
            PagePermission.EXECUTE_HUNTS.value,
            PagePermission.EDIT_HUNTS.value,
            PagePermission.DELETE_HUNTS.value,
            PagePermission.VIEW_HUNT_RESULTS.value
        ],
        default_roles=["ADMIN", "EXECUTIVE", "MANAGER", "TI", "TH", "IR"]
    ),
    "reports": PageDefinition(
        page_key="reports",
        page_name="Reports",
        page_path="/reports",
        description="Report management and generation",
        category="Reporting",
        permissions=[
            PagePermission.VIEW_REPORTS.value,
            PagePermission.CREATE_REPORTS.value,
            PagePermission.EDIT_REPORTS.value,
            PagePermission.DELETE_REPORTS.value,
            PagePermission.PUBLISH_REPORTS.value,
            PagePermission.SHARE_REPORTS.value,
            PagePermission.EXPORT_REPORTS.value
        ],
        default_roles=["ADMIN", "EXECUTIVE", "MANAGER", "TI", "TH", "IR"]
    ),
    "connectors": PageDefinition(
        page_key="connectors",
        page_name="Connectors",
        page_path="/connectors",
        description="Integration connectors management",
        category="Configuration",
        permissions=[
            PagePermission.VIEW_CONNECTORS.value,
            PagePermission.MANAGE_CONNECTORS.value,
            PagePermission.TEST_CONNECTORS.value
        ],
        default_roles=["ADMIN"]
    ),
    "sources": PageDefinition(
        page_key="sources",
        page_name="Feed Sources",
        page_path="/sources",
        description="Manage RSS/API feed sources",
        category="Configuration",
        permissions=[
            PagePermission.VIEW_SOURCES.value,
            PagePermission.MANAGE_SOURCES.value
        ],
        default_roles=["ADMIN", "TI"]
    ),
    "watchlist": PageDefinition(
        page_key="watchlist",
        page_name="Watchlist",
        page_path="/watchlist",
        description="Keyword watchlist management",
        category="Configuration",
        permissions=[
            PagePermission.VIEW_WATCHLIST.value,
            PagePermission.MANAGE_WATCHLIST.value
        ],
        default_roles=["ADMIN", "TI"]
    ),
    "audit": PageDefinition(
        page_key="audit",
        page_name="Audit Logs",
        page_path="/audit",
        description="System audit trail",
        category="Administration",
        permissions=[
            PagePermission.VIEW_AUDIT.value,
            PagePermission.EXPORT_AUDIT.value
        ],
        default_roles=["ADMIN", "MANAGER"]
    ),
    "admin": PageDefinition(
        page_key="admin",
        page_name="Admin Portal",
        page_path="/admin",
        description="System administration",
        category="Administration",
        permissions=[
            PagePermission.VIEW_ADMIN.value,
            PagePermission.MANAGE_USERS.value,
            PagePermission.MANAGE_SYSTEM.value,
            PagePermission.MANAGE_GENAI.value,
            PagePermission.MANAGE_KNOWLEDGE.value,
            PagePermission.MANAGE_RBAC.value
        ],
        default_roles=["ADMIN"]
    ),
    "chatbot": PageDefinition(
        page_key="chatbot",
        page_name="Parshu AI",
        page_path="/chat",
        description="AI-powered chatbot assistant",
        category="Tools",
        permissions=[
            PagePermission.USE_CHATBOT.value,
            PagePermission.VIEW_CHATBOT_HISTORY.value
        ],
        default_roles=["ADMIN", "TI", "TH", "IR", "VIEWER"]
    )
}


def get_all_page_definitions() -> List[PageDefinition]:
    """Get all page definitions."""
    return list(PAGE_DEFINITIONS.values())


def get_page_permissions(page_key: str) -> List[str]:
    """Get all permissions for a specific page."""
    if page_key in PAGE_DEFINITIONS:
        return PAGE_DEFINITIONS[page_key].permissions
    return []


def get_default_page_access_for_role(role: str) -> List[str]:
    """Get list of pages a role has access to by default."""
    accessible_pages = []
    for page_key, page_def in PAGE_DEFINITIONS.items():
        if role in page_def.default_roles:
            accessible_pages.append(page_key)
    return accessible_pages


# Default page permission mappings for each role
DEFAULT_ROLE_PAGE_PERMISSIONS = {
    "ADMIN": [p.value for p in PagePermission],  # All permissions
    "EXECUTIVE": [
        # Dashboard
        PagePermission.VIEW_DASHBOARD.value,
        # Feed
        PagePermission.VIEW_FEED.value,
        # Articles
        PagePermission.VIEW_ARTICLES.value,
        # Article Detail
        PagePermission.VIEW_ARTICLE_CONTENT.value,
        # Intelligence
        PagePermission.VIEW_INTELLIGENCE.value,
        PagePermission.EXPORT_INTELLIGENCE.value,
        # Hunts
        PagePermission.VIEW_HUNTS.value,
        PagePermission.VIEW_HUNT_RESULTS.value,
        # Reports
        PagePermission.VIEW_REPORTS.value,
        PagePermission.EXPORT_REPORTS.value,
        # Sources
        PagePermission.VIEW_SOURCES.value,
    ],
    "MANAGER": [
        # Dashboard
        PagePermission.VIEW_DASHBOARD.value,
        # Feed
        PagePermission.VIEW_FEED.value,
        # Articles
        PagePermission.VIEW_ARTICLES.value,
        PagePermission.TRIAGE_ARTICLES.value,
        # Article Detail
        PagePermission.VIEW_ARTICLE_CONTENT.value,
        PagePermission.VIEW_ARTICLE_INTELLIGENCE.value,
        PagePermission.VIEW_ARTICLE_HUNTS.value,
        # Intelligence
        PagePermission.VIEW_INTELLIGENCE.value,
        PagePermission.EXPORT_INTELLIGENCE.value,
        # Hunts
        PagePermission.VIEW_HUNTS.value,
        PagePermission.VIEW_HUNT_RESULTS.value,
        # Reports
        PagePermission.VIEW_REPORTS.value,
        PagePermission.CREATE_REPORTS.value,
        PagePermission.SHARE_REPORTS.value,
        PagePermission.EXPORT_REPORTS.value,
        # Audit
        PagePermission.VIEW_AUDIT.value,
        PagePermission.EXPORT_AUDIT.value,
        # Sources
        PagePermission.VIEW_SOURCES.value,
    ],
    "TI": [
        # Dashboard
        PagePermission.VIEW_DASHBOARD.value,
        # Feed
        PagePermission.VIEW_FEED.value,
        PagePermission.MANAGE_FEED_SOURCES.value,
        # Articles
        PagePermission.VIEW_ARTICLES.value,
        PagePermission.EDIT_ARTICLES.value,
        PagePermission.TRIAGE_ARTICLES.value,
        PagePermission.ASSIGN_ARTICLES.value,
        # Article Detail
        PagePermission.VIEW_ARTICLE_CONTENT.value,
        PagePermission.VIEW_ARTICLE_INTELLIGENCE.value,
        PagePermission.VIEW_ARTICLE_HUNTS.value,
        PagePermission.VIEW_ARTICLE_COMMENTS.value,
        PagePermission.EDIT_ARTICLE_INTELLIGENCE.value,
        # Intelligence
        PagePermission.VIEW_INTELLIGENCE.value,
        PagePermission.EDIT_INTELLIGENCE.value,
        PagePermission.EXPORT_INTELLIGENCE.value,
        # Hunts
        PagePermission.VIEW_HUNTS.value,
        PagePermission.CREATE_HUNTS.value,
        # Reports
        PagePermission.VIEW_REPORTS.value,
        PagePermission.CREATE_REPORTS.value,
        PagePermission.EDIT_REPORTS.value,
        PagePermission.PUBLISH_REPORTS.value,
        PagePermission.SHARE_REPORTS.value,
        PagePermission.EXPORT_REPORTS.value,
        # Sources
        PagePermission.VIEW_SOURCES.value,
        PagePermission.MANAGE_SOURCES.value,
        # Watchlist
        PagePermission.VIEW_WATCHLIST.value,
        PagePermission.MANAGE_WATCHLIST.value,
        # Chatbot
        PagePermission.USE_CHATBOT.value,
        PagePermission.VIEW_CHATBOT_HISTORY.value
    ],
    "TH": [
        # Dashboard
        PagePermission.VIEW_DASHBOARD.value,
        # Feed
        PagePermission.VIEW_FEED.value,
        # Articles
        PagePermission.VIEW_ARTICLES.value,
        # Article Detail
        PagePermission.VIEW_ARTICLE_CONTENT.value,
        PagePermission.VIEW_ARTICLE_INTELLIGENCE.value,
        PagePermission.VIEW_ARTICLE_HUNTS.value,
        # Intelligence
        PagePermission.VIEW_INTELLIGENCE.value,
        PagePermission.EXPORT_INTELLIGENCE.value,
        # Hunts
        PagePermission.VIEW_HUNTS.value,
        PagePermission.CREATE_HUNTS.value,
        PagePermission.EXECUTE_HUNTS.value,
        PagePermission.EDIT_HUNTS.value,
        PagePermission.DELETE_HUNTS.value,
        PagePermission.VIEW_HUNT_RESULTS.value,
        # Reports
        PagePermission.VIEW_REPORTS.value,
        PagePermission.EXPORT_REPORTS.value,
        # Sources
        PagePermission.VIEW_SOURCES.value,
        # Chatbot
        PagePermission.USE_CHATBOT.value
    ],
    "IR": [
        # Dashboard
        PagePermission.VIEW_DASHBOARD.value,
        # Feed
        PagePermission.VIEW_FEED.value,
        # Articles
        PagePermission.VIEW_ARTICLES.value,
        PagePermission.TRIAGE_ARTICLES.value,
        # Article Detail
        PagePermission.VIEW_ARTICLE_CONTENT.value,
        PagePermission.VIEW_ARTICLE_INTELLIGENCE.value,
        PagePermission.VIEW_ARTICLE_HUNTS.value,
        PagePermission.VIEW_ARTICLE_COMMENTS.value,
        # Intelligence
        PagePermission.VIEW_INTELLIGENCE.value,
        # Hunts
        PagePermission.VIEW_HUNTS.value,
        PagePermission.EXECUTE_HUNTS.value,
        PagePermission.VIEW_HUNT_RESULTS.value,
        # Reports
        PagePermission.VIEW_REPORTS.value,
        PagePermission.SHARE_REPORTS.value,
        # Sources
        PagePermission.VIEW_SOURCES.value,
        # Chatbot
        PagePermission.USE_CHATBOT.value
    ],
    "VIEWER": [
        # Feed / News - VIEWER can only access news and feeds
        PagePermission.VIEW_FEED.value,
        # Chatbot / Parshu AI
        PagePermission.USE_CHATBOT.value,
        PagePermission.VIEW_CHATBOT_HISTORY.value
    ]
}
