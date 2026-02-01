"""
Unified Permission System for Parshu Platform.

This consolidates all permission definitions into a single source of truth.
Each role has:
1. Accessible pages (for UI visibility)
2. API permissions (for backend enforcement)

PRINCIPLE: If you can't see a page, you can't access its APIs.
"""
from typing import List, Dict, Set
from app.models import UserRole


# =============================================================================
# PAGE DEFINITIONS - What pages exist and their identifiers
# =============================================================================
PAGES = {
    "dashboard": {"name": "Operations", "path": "/dashboard"},
    "feed": {"name": "News & Feeds", "path": "/news"},
    "articles": {"name": "Articles", "path": "/articles"},
    "intelligence": {"name": "Intelligence", "path": "/intelligence"},
    "hunts": {"name": "Threat Hunts", "path": "/hunts"},
    "reports": {"name": "Reports", "path": "/reports"},
    "sources": {"name": "Sources", "path": "/sources"},
    "watchlist": {"name": "Watchlist", "path": "/watchlist"},
    "audit": {"name": "Audit Logs", "path": "/audit"},
    "admin": {"name": "Admin", "path": "/admin"},
}


# =============================================================================
# ROLE -> PAGE ACCESS MAPPING
# This is the SINGLE SOURCE OF TRUTH for what pages each role can access
# =============================================================================
ROLE_PAGE_ACCESS: Dict[str, List[str]] = {
    # ADMIN - Full access to all pages
    "ADMIN": list(PAGES.keys()),
    
    # EXECUTIVE - Read-only access to dashboards and reports
    "EXECUTIVE": [
        "dashboard",
        "reports",
    ],
    
    # MANAGER - Team oversight, reports, and audit
    "MANAGER": [
        "dashboard",
        "feed",
        "articles",
        "reports",
        "audit",
    ],
    
    # TI (Threat Intelligence) - Full intel workflow
    "TI": [
        "dashboard",
        "feed",
        "articles",
        "intelligence",
        "hunts",
        "reports",
        "sources",
        "watchlist",
    ],
    
    # TH (Threat Hunter) - Hunt-focused access
    "TH": [
        "dashboard",
        "feed",
        "articles",
        "intelligence",
        "hunts",
        "sources",
    ],
    
    # IR (Incident Response) - Response-focused access
    "IR": [
        "dashboard",
        "feed",
        "articles",
        "intelligence",
        "hunts",
        "reports",
    ],
    
    # VIEWER - Minimal read-only access (News/Feeds only)
    "VIEWER": [
        "feed",
    ],
}


# =============================================================================
# ROLE -> API PERMISSION MAPPING
# Maps roles to what API actions they can perform
# =============================================================================
ROLE_API_PERMISSIONS: Dict[str, List[str]] = {
    "ADMIN": [
        # All permissions
        "read:*", "write:*", "delete:*", "manage:*",
    ],
    
    "EXECUTIVE": [
        "read:dashboard",
        "read:reports",
    ],
    
    "MANAGER": [
        "read:dashboard",
        "read:articles",
        "read:feed",
        "read:reports",
        "create:reports",
        "read:audit",
    ],
    
    "TI": [
        "read:dashboard",
        "read:articles", "triage:articles", "analyze:articles",
        "read:feed",
        "read:intelligence", "extract:intelligence",
        "read:hunts", "create:hunts",
        "read:reports", "create:reports", "share:reports",
        "read:sources", "manage:sources",
        "read:watchlist", "manage:watchlist",
    ],
    
    "TH": [
        "read:dashboard",
        "read:articles",
        "read:feed",
        "read:intelligence",
        "read:hunts", "create:hunts", "execute:hunts", "manage:hunts",
        "read:sources",
    ],
    
    "IR": [
        "read:dashboard",
        "read:articles", "triage:articles",
        "read:feed",
        "read:intelligence",
        "read:hunts", "execute:hunts",
        "read:reports", "share:reports",
    ],
    
    "VIEWER": [
        "read:feed",
        "read:articles",  # Can read articles in the feed
    ],
}


def get_role_pages(role: str) -> List[str]:
    """Get list of page keys accessible to a role."""
    return ROLE_PAGE_ACCESS.get(role, [])


def get_role_page_details(role: str) -> List[Dict]:
    """Get detailed page info for a role's accessible pages."""
    page_keys = get_role_pages(role)
    result = []
    for key in page_keys:
        if key in PAGES:
            result.append({
                "key": key,
                "name": PAGES[key]["name"],
                "path": PAGES[key]["path"],
            })
    return result


def can_access_page(role: str, page_key: str) -> bool:
    """Check if a role can access a specific page."""
    return page_key in get_role_pages(role)


def get_role_api_permissions(role: str) -> List[str]:
    """Get API permissions for a role."""
    return ROLE_API_PERMISSIONS.get(role, [])


def has_api_permission(role: str, permission: str) -> bool:
    """Check if a role has a specific API permission."""
    permissions = get_role_api_permissions(role)
    
    # Check for wildcard permissions (admin)
    if "read:*" in permissions and permission.startswith("read:"):
        return True
    if "write:*" in permissions and permission.startswith("write:"):
        return True
    if "delete:*" in permissions and permission.startswith("delete:"):
        return True
    if "manage:*" in permissions and permission.startswith("manage:"):
        return True
    
    return permission in permissions


def get_all_roles_permissions() -> Dict[str, Dict]:
    """Get complete permissions matrix for all roles."""
    result = {}
    for role in UserRole:
        role_name = role.value
        result[role_name] = {
            "pages": get_role_page_details(role_name),
            "api_permissions": get_role_api_permissions(role_name),
        }
    return result
