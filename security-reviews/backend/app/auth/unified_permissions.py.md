# Security Review: `backend/app/auth/unified_permissions.py`

Reviewed: 2026-02-02

## Key risk found

### RBAC “source-of-truth” drift (High)

**What was happening**
- `unified_permissions.py` contained hard-coded `PAGES`, `ROLE_PAGE_ACCESS`, and `ROLE_API_PERMISSIONS`.
- Other parts of the codebase defined overlapping registries (`page_permissions.py`, `rbac.py`), and the frontend relies on `/users/my-permissions` for navigation decisions.

**Why it matters**
- Divergent registries create “UI says no, API says yes” / “UI says yes, API says no” outcomes.
- In practice this causes authorization confusion and increases the chance of bypasses during refactors.

## Fix

- Refactored `unified_permissions.py` to derive:
  - `PAGES` / `ROLE_PAGE_ACCESS` from `app.auth.page_permissions` (`PAGE_DEFINITIONS` + `default_roles`)
  - `ROLE_API_PERMISSIONS` from `app.auth.rbac.get_user_permissions`
- Kept the public function surface (`get_role_pages`, `get_role_page_details`, `get_role_api_permissions`, `has_api_permission`) so existing callers continue to work.

## Validation

- Regression tests: `backend/tests/test_permissions_endpoints.py`.
- Full backend test suite: `backend/.venv310/Scripts/python -m pytest -q` (passes as of 2026-02-02).

