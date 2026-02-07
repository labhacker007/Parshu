# Security Review: `backend/app/auth/dependencies.py`

Reviewed: 2026-02-02

Scope: authentication (JWT validation), authorization enforcement (`require_permission`), and role impersonation controls.

## Key risks found

### 1) Impersonation claim trust (High)

**What was happening**
- Tokens containing `is_impersonating` + `role` could influence the effective role used for authorization.

**Why it matters**
- If impersonation claims are honored without an independent server-side authorization check, any token issuance bug (or key compromise) becomes a privilege escalation amplifier.

**Fix**
- Impersonation claims are only honored if the **actual DB role** is `ADMIN`.

### 2) Inconsistent JWT `sub` typing (Low/Medium)

**What was happening**
- Some flows issued `sub` as a string; code paths assumed it could be used as an `int`.

**Why it matters**
- Inconsistent typing causes brittle auth behavior and increases risk during refactors.

**Fix**
- `sub` is now cast defensively to `int` and invalid values are rejected with a generic 401.

### 3) Multiple permission sources-of-truth (High)

**What was happening**
- Authorization checks combined multiple systems (new/legacy), creating drift risk and unexpected grants.

**Fix**
- `require_permission` now uses a single source-of-truth for API authorization: `app.auth.rbac.has_permission(...)` (plus per-user `custom_permissions` and `additional_roles`).

## Validation

- Backend tests: `backend/.venv310/Scripts/python -m pytest -q` (passes as of 2026-02-02).
