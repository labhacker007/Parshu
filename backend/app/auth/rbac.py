from typing import Optional, List
from enum import Enum
from app.models import UserRole


class Permission(str, Enum):
    """Fine-grained permissions tied to roles."""
    # Articles
    READ_ARTICLES = "read:articles"
    TRIAGE_ARTICLES = "triage:articles"
    ANALYZE_ARTICLES = "analyze:articles"
    CREATE_SUMMARY = "create:summary"
    
    # Hunts
    READ_HUNTS = "read:hunts"
    CREATE_HUNTS = "create:hunts"
    EXECUTE_HUNTS = "execute:hunts"
    MANAGE_HUNTS = "manage:hunts"
    
    # Intelligence
    READ_INTELLIGENCE = "read:intelligence"
    EXTRACT_INTELLIGENCE = "extract:intelligence"
    
    # Reports
    READ_REPORTS = "read:reports"
    CREATE_REPORTS = "create:reports"
    EDIT_REPORTS = "edit:reports"
    PUBLISH_REPORTS = "publish:reports"
    SHARE_REPORTS = "share:reports"
    
    # Sources
    READ_SOURCES = "read:sources"
    MANAGE_SOURCES = "manage:sources"
    
    # Admin
    MANAGE_USERS = "manage:users"
    MANAGE_CONNECTORS = "manage:connectors"
    VIEW_AUDIT_LOGS = "view:audit_logs"
    MANAGE_WATCHLISTS = "manage:watchlists"
    MANAGE_GENAI = "manage:genai"
    MANAGE_KNOWLEDGE = "manage:knowledge"
    MANAGE_RBAC = "manage:rbac"
    
    # Analytics
    VIEW_ANALYTICS = "view:analytics"
    
    # GenAI Testing
    TEST_GENAI = "test:genai"
    VIEW_GENAI = "view:genai"


ROLE_PERMISSIONS = {
    UserRole.ADMIN: [p.value for p in Permission],  # All permissions
    
    # EXECUTIVE: C-Suite, CISO - read-only access to reports and dashboards
    UserRole.EXECUTIVE: [
        Permission.READ_ARTICLES.value,
        Permission.READ_REPORTS.value,
        Permission.READ_HUNTS.value,
        Permission.READ_SOURCES.value,
        Permission.READ_INTELLIGENCE.value,
        # Executives can view but not modify
    ],
    
    # MANAGER: Team leads - reports, metrics, and limited team oversight
    UserRole.MANAGER: [
        Permission.READ_ARTICLES.value,
        Permission.TRIAGE_ARTICLES.value,
        Permission.READ_REPORTS.value,
        Permission.CREATE_REPORTS.value,
        Permission.SHARE_REPORTS.value,
        Permission.READ_HUNTS.value,
        Permission.READ_SOURCES.value,
        Permission.READ_INTELLIGENCE.value,
        Permission.VIEW_AUDIT_LOGS.value,  # Managers can view audit logs for their team
    ],
    
    # TI: Threat Intelligence Analyst - full article analysis and reporting
    UserRole.TI: [
        Permission.READ_ARTICLES.value,
        Permission.TRIAGE_ARTICLES.value,
        Permission.ANALYZE_ARTICLES.value,
        Permission.CREATE_SUMMARY.value,
        Permission.READ_INTELLIGENCE.value,
        Permission.EXTRACT_INTELLIGENCE.value,
        Permission.READ_REPORTS.value,
        Permission.CREATE_REPORTS.value,
        Permission.EDIT_REPORTS.value,
        Permission.PUBLISH_REPORTS.value,
        Permission.SHARE_REPORTS.value,
        Permission.READ_HUNTS.value,
        Permission.CREATE_HUNTS.value,
        Permission.READ_SOURCES.value,
    ],
    
    # TH: Threat Hunter - hunt creation and execution
    UserRole.TH: [
        Permission.READ_ARTICLES.value,
        Permission.READ_HUNTS.value,
        Permission.CREATE_HUNTS.value,
        Permission.EXECUTE_HUNTS.value,
        Permission.MANAGE_HUNTS.value,
        Permission.READ_INTELLIGENCE.value,
        Permission.READ_REPORTS.value,
        Permission.READ_SOURCES.value,
    ],
    
    # IR: Incident Response - hunt execution and report sharing
    UserRole.IR: [
        Permission.READ_ARTICLES.value,
        Permission.READ_HUNTS.value,
        Permission.EXECUTE_HUNTS.value,
        Permission.READ_INTELLIGENCE.value,
        Permission.READ_REPORTS.value,
        Permission.SHARE_REPORTS.value,
        Permission.READ_SOURCES.value,
    ],
    
    # VIEWER: Very limited read-only access - only news/feeds and chatbot
    UserRole.VIEWER: [
        Permission.READ_ARTICLES.value,  # Needed to view feed items
        Permission.READ_SOURCES.value,   # Needed to see feed sources list
    ],
}


def get_user_permissions(role: UserRole) -> List[str]:
    """Get all permissions for a user role."""
    return ROLE_PERMISSIONS.get(role, [])


def has_permission(user_role: UserRole, required_permission: str) -> bool:
    """Check if a user role has a specific permission."""
    permissions = get_user_permissions(user_role)
    return required_permission in permissions
