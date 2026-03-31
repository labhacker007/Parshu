"""
Unified Permission System for Jyoti Platform.

This module is consumed by:
- `/users/my-permissions` (frontend navigation / impersonation support)
- some admin endpoints that display role capabilities

To reduce RBAC drift, the data in this module is derived from:
- `app.auth.page_permissions` (page registry / navigation)
- `app.auth.rbac` (API permission registry)
"""
from typing import List, Dict

from app.models import UserRole
from app.auth.page_permissions import PAGE_DEFINITIONS, get_default_page_access_for_role, DEFAULT_ROLE_PAGE_PERMISSIONS
from app.auth.rbac import get_user_permissions


def _build_pages() -> Dict[str, Dict[str, str]]:
    pages: Dict[str, Dict[str, str]] = {}
    for key, page_def in PAGE_DEFINITIONS.items():
        pages[key] = {"name": page_def.page_name, "path": page_def.page_path}
    return pages


def _build_role_page_access() -> Dict[str, List[str]]:
    access: Dict[str, List[str]] = {}
    for role in UserRole:
        access[role.value] = get_default_page_access_for_role(role.value)
    return access


def _build_role_api_permissions() -> Dict[str, List[str]]:
    perms: Dict[str, List[str]] = {}
    for role in UserRole:
        perms[role.value] = get_user_permissions(role)
    return perms


PAGES = _build_pages()
ROLE_PAGE_ACCESS = _build_role_page_access()
ROLE_API_PERMISSIONS = _build_role_api_permissions()


def get_role_pages(role: str) -> List[str]:
    """Get list of page keys accessible to a role."""
    return ROLE_PAGE_ACCESS.get(role, [])


def get_role_page_details(role: str) -> List[Dict]:
    """Get detailed page info for a role's accessible pages."""
    page_keys = get_role_pages(role)
    result = []
    role_page_perms = set(DEFAULT_ROLE_PAGE_PERMISSIONS.get(role, []))
    for key in page_keys:
        if key in PAGES and key in PAGE_DEFINITIONS:
            result.append({
                "key": key,
                "name": PAGES[key]["name"],
                "path": PAGES[key]["path"],
                # UI-level permissions are derived from the page registry defaults.
                # These are not used for API enforcement.
                "permissions": [p for p in PAGE_DEFINITIONS[key].permissions if p in role_page_perms],
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
