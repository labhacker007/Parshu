# Security Review: `backend/app/auth/page_permissions.py`

Scope: authorization model hygiene (RBAC), permission taxonomy, and “policy as code” drift risks.

This file defines page/tab permissions and default role access for UI/navigation and RBAC administration flows. By itself it does **not** enforce access control; enforcement must happen in API dependencies/middleware.

## Findings (what to fix)

### 1) Competing RBAC sources-of-truth → drift/bypass risk (High)
**What I see**
- This file defines:
  - `PagePermission` enum (strings like `page:admin:manage_rbac`)
  - `PAGE_DEFINITIONS` (pages → permissions + `default_roles`)
  - `DEFAULT_ROLE_PAGE_PERMISSIONS` (roles → permissions)
- Elsewhere, admin routes reference a separate “unified permissions” system (`app.auth.unified_permissions`), indicating at least two permission models in the codebase.

**Why it matters**
- When UI navigation, admin RBAC editing, and API enforcement derive from different maps, you eventually get:
  - “UI says no, API allows” (real security issue), or
  - “UI says yes, API denies” (breaks workflows and leads to quick insecure bypasses).

**Fix**
- Consolidate to **one** permission registry for the backend:
  - Either make `PAGE_DEFINITIONS` generated from the unified permissions registry, or delete this file and reference the unified registry everywhere.
- Add a CI test that fails if:
  - A permission exists in one registry but not the other.
  - A role’s default permissions include unknown permission keys.

**Acceptance criteria**
- There is exactly one backend “source of truth” for permission keys.
- A test guarantees registries cannot drift.

---

### 2) `default_roles` + page permissions can be misread as “page access grants all page permissions” (Medium)
**What I see**
- `PAGE_DEFINITIONS["feed"]` includes both `VIEW_FEED` and `MANAGE_FEED_SOURCES`, and lists `VIEWER` in `default_roles`.

**Why it matters**
- Today, if API endpoints correctly check granular permissions, this is fine.
- The risk is **future refactors**: a developer might use `default_roles` as a shortcut to grant *all* permissions in `PAGE_DEFINITIONS[page].permissions` to that role, accidentally giving a low-privilege role a management capability.

**Fix**
- Keep `default_roles` only for navigation visibility (if you need it), and ensure it never implies management actions.
- Consider splitting “navigation permission” from “action permissions”:
  - Example: feed page only requires `VIEW_FEED`, while feed-source management requires `MANAGE_FEED_SOURCES` on specific endpoints/components.
- Add a CI assertion: for low-privilege roles (e.g. `VIEWER`), disallow any `manage_*`, `delete_*`, `admin:*` permissions.

**Acceptance criteria**
- A viewer (or equivalent) cannot accidentally inherit management permissions via page defaults.

---

### 3) Roles are plain strings (Low/Medium)
**What I see**
- Roles are represented as raw strings in `default_roles` and `DEFAULT_ROLE_PAGE_PERMISSIONS` (e.g. `"ADMIN"`, `"TI"`).

**Why it matters**
- Typos and inconsistent casing silently degrade authorization logic and can cause unexpected allow/deny behavior.

**Fix**
- Use a shared `Enum` (or a single validated type) for roles, and validate at boundaries (JWT/session parsing, admin APIs).
- Add unit tests verifying that every role referenced here is a valid role.

**Acceptance criteria**
- Invalid role strings are rejected early and loudly.

---

### 4) Unused helpers/mappings create “false confidence” (Low)
**What I see**
- `get_page_permissions()` and `DEFAULT_ROLE_PAGE_PERMISSIONS` are defined here; if they are not used for enforcement, they can mislead maintainers into thinking access control exists.

**Why it matters**
- Security controls that “look implemented” but aren’t wired to enforcement are a classic source of authorization gaps.

**Fix**
- If these are meant for UI/admin display only, rename and document them clearly.
- If they are meant for enforcement, ensure API routes consistently depend on permission checks derived from the same registry.

**Acceptance criteria**
- No dead/unused permission-mapping code remains without explicit documentation and tests.

---

## Status update (2026-02-02)

Mitigation applied to reduce RBAC drift between UI navigation, admin RBAC display, and backend “my permissions” output:

- `backend/app/auth/unified_permissions.py` now derives page access from `PAGE_DEFINITIONS` and API permissions from `app.auth.rbac` (removes hard-coded parallel registries).
- `backend/app/users/routes.py` now returns `all_permissions` (in addition to `api_permissions`) to match the frontend contract.
- `backend/app/admin/routes.py` `/admin/rbac/pages/role/{role}` now returns page-level `all_permissions` (per-page) plus `granted_permissions` subset (defaults or persisted page permissions when present), instead of incorrectly returning API permissions as “page permissions”.
- Regression tests added: `backend/tests/test_permissions_endpoints.py`.
