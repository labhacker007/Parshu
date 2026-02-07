# Security Review: `backend/app/main.py`

Scope: middleware order, security headers, CORS posture, unauthenticated setup endpoints, and “dev convenience” behavior in production.

## Findings (what to fix)

### 1) Unauthenticated `/setup/*` endpoints (High)
**What I see**
- `POST /setup/seed`
- `POST /setup/fix-schema`
- `POST /setup/ingest`
- These endpoints appear to have **no authentication/authorization** guard.

**Why it matters**
- In any non-local deployment, these become dangerous admin-like capabilities:
  - Seeding can create/modify baseline data and potentially bootstrap admin flows (depending on env).
  - Schema changes should never be exposed via public HTTP.
  - Ingestion can be abused for DoS and to trigger network fetches.

**Fix**
- Disable these endpoints entirely in production (recommended), or:
  - Protect them behind a strong admin permission (`require_permission(Permission.MANAGE_SYSTEM.value)`), and/or
  - Require a one-time bootstrap token stored as a secret (and rotate/disable after setup).

**Acceptance criteria**
- In production, `/setup/*` routes are not registered or always return `404`.
- In dev, they are accessible only to an authenticated admin.

---

### 2) Startup-time “schema migrations” via raw `ALTER TABLE` (Medium/High)
**What I see**
- `run_schema_migrations()` runs raw SQL `ALTER TABLE ...` during app startup.

**Why it matters**
- Automatic schema changes at runtime increase operational risk and can be abused if any path ever lets an attacker influence DB connection/config.
- It also makes change control/audit harder (migration history is not tracked like Alembic).

**Fix**
- Move schema changes to proper migrations (Alembic) and run them via deployment pipeline.
- Keep runtime checks read-only (e.g., sanity checks), not schema mutation.

**Acceptance criteria**
- No schema mutation occurs automatically at app startup.

---

### 3) Auto-seeding database at startup (Medium)
**What I see**
- In `lifespan()`, if `User` table is empty, `seed_database()` is invoked automatically.

**Why it matters**
- In a fresh prod DB, this could seed unintended data or create predictable state.
- In some environments, “empty DB” is a common condition (blue/green, new region).

**Fix**
- Only allow auto-seeding under an explicit dev flag (e.g., `ALLOW_AUTO_SEED=true`) and never default it on.

**Acceptance criteria**
- Production deployments do not auto-seed.

---

### 4) Content-Security-Policy is very permissive (Medium)
**What I see**
- CSP includes `script-src 'unsafe-inline' 'unsafe-eval'`.

**Why it matters**
- This weakens XSS defenses significantly (though if this service is API-only, CSP may be less relevant).

**Fix**
- If this server serves a UI: remove `unsafe-eval`, minimize `unsafe-inline`, and use nonces/hashes.
- If API-only: consider omitting CSP entirely or setting a strict minimal policy.

**Acceptance criteria**
- CSP aligns with how content is actually served (UI vs API) and does not include `unsafe-eval` without strong justification.

---

### 5) CORS is enabled with credentials (Low/Medium)
**What I see**
- `allow_credentials=True` with origins from `settings.CORS_ORIGINS`.
- A check prevents wildcard `*` when credentials are enabled (good).

**Why it matters**
- With credentialed CORS, origin lists must be tightly controlled and never user-configurable at runtime.

**Fix**
- Ensure `CORS_ORIGINS` is restricted in prod and validated at startup (no wildcards, no regex-like patterns).
- Consider separate config for dev vs prod.

**Acceptance criteria**
- Production origins list is explicit and minimal; wildcard is impossible.

