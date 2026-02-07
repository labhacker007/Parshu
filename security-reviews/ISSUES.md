# Security Issues Inventory

Last updated: **2026-02-02**

Review coverage is still **partial** (we have not audited every file in the repo). This file tracks findings discovered so far and their current status.

## Fixed / mitigated (so far)

- [x] **High** `docker-compose.dev.yml`: removed default DB creds/default `SECRET_KEY`, bound DB/Redis ports to `127.0.0.1`, and separated dev vs prod compose.
- [x] **Medium** `docker-compose.yml`: added a production-oriented compose without bind mounts and without default credentials.
- [x] **High** `infra/Dockerfile.backend`: multi-stage build + non-root runtime user + removed build toolchain/tests from runtime image.
- [x] **Medium** `infra/Dockerfile.frontend`: non-root runtime user.
- [x] **High** `backend/app/core/config.py`: removed credential-bearing defaults; added explicit `ENV` + boolean `DEBUG`; fail-fast for missing `SECRET_KEY`/`DATABASE_URL` in prod; dev/test get safe defaults.
- [x] **High** SSRF class of issues across `backend/app/knowledge/crawler.py`, `backend/app/ingestion/parser.py`, `backend/app/users/feeds.py`: centralized outbound URL validation + redirect validation + response size caps via `backend/app/core/ssrf.py` and `backend/app/core/fetch.py`.
- [x] **High** `backend/app/main.py`: `/setup/*` disabled in prod and optionally gated by `SETUP_TOKEN`; CSP tightened (no `unsafe-eval`, limited `unsafe-inline` to docs only).
- [x] **High** `backend/app/core/rate_limit.py`: normalized keys to prevent high-cardinality memory DoS; added proxy-aware client IP handling with trusted proxy allowlist; added Redis-backed limiter fallback; tests run with `ENV=test` and bypass middleware.
- [x] **High** `backend/app/auth/dependencies.py`: impersonation claims now require DB role `ADMIN`, token decode details no longer leak, and API permission checks use a single source-of-truth (`app.auth.rbac`) plus per-user grants/denies and additional roles.
- [x] **High** `backend/app/auth/saml.py` + `frontend/src/pages/Login.js`: SSO tokens no longer placed in query strings (moved to URL fragment); frontend accepts both for backward compatibility.
- [x] **Medium** `backend/app/routers/__init__.py`: `/auth/register` now enforces a minimum password length (12+), and `/auth/login` no longer sleeps per request (dummy verify instead).
- [x] **High** `backend/app/reports/routes.py`: replaced ad-hoc role checks with explicit permissions for edit/publish/unpublish; added `edit:reports` and `publish:reports` to RBAC.
- [x] **High** `backend/app/reports/routes.py`: mitigated stored XSS in `GET /reports/{id}/export/html` via output encoding + strict URL/CSS sanitization + safe link rendering.
- [x] **Medium/High** `backend/app/reports/routes.py`: mitigated CSV/Excel formula injection in `GET /reports/{id}/export/csv` via cell prefixing for dangerous leading characters.
- [x] **Medium** `backend/app/articles/routes.py`: removed raw exception details from image-fetch error responses.
- [x] **High** `backend/app/knowledge/routes.py`: restricted admin/global KB APIs to `manage:knowledge`, enforced doc ownership checks, prevented path traversal on upload, and fixed background-task DB session reuse.
- [x] **Medium** `backend/app/iocs/routes.py`: removed raw exception details from multiple 500 responses.
- [x] **High** `backend/app/genai/routes.py`: admin endpoints protected with `require_permission("manage:genai")`; provider status redacts sensitive fields for non-admins.
- [x] **High** secrets-at-rest: dedicated encryption support added (`CONFIG_ENCRYPTION_KEY`) and decrypt is fail-closed (`backend/app/core/crypto.py`, used by `backend/app/admin/routes.py` and `backend/app/genai/provider.py`).
- [x] **Medium** `backend/app/admin/routes.py`: removed raw exception strings from 500/502 responses and from `"error"/"reason"` JSON fields; added regression test.
- [x] **High** RBAC drift reduction: `backend/app/auth/unified_permissions.py`, `backend/app/auth/page_permissions.py`, `backend/app/users/routes.py`, `backend/app/admin/routes.py`: unified page access + permission display for the UI and added regression tests for `/users/my-permissions` and `/admin/rbac/pages/role/{role}`.
- [x] **Critical** `infra/k8s-manifests.yaml`: replaced with safer baseline (Secrets for creds, no public LoadBalancers, SecurityContexts/seccomp, PVC for Postgres, NetworkPolicies).

Validation: `backend/.venv310/Scripts/python -m pytest -q` => **17 passed**.

## Remaining (needs work)

- [ ] **Low/Med** `docker-compose.dev.yml` + `infra/k8s-manifests.yaml`: supply-chain pinning (digests / immutable tags), image signing, CI SCA.
- [ ] **Medium** `infra/Dockerfile.backend`: base image digest pinning and dependency locking (hashes/lockfile).
- [ ] **Medium** `backend/app/genai/routes.py`: enforce a server-side model allowlist (per role/quota) before provider calls.
- [ ] **Med/High** `backend/app/main.py`: startup schema mutation via raw SQL still exists (now dev-only); should be migrated to Alembic/deployment migrations.

## Next high-risk areas to review (not yet reviewed)

- AuthN/AuthZ enforcement: JWT/session code, admin RBAC service/routes, all `require_permission(...)` usage.
- Data access / IDOR: routes under `backend/app/*/routes.py` that accept IDs (articles, reports, knowledge, users).
- GenAI execution: `backend/app/chatbot/service.py`, `backend/app/genai/unified_service.py`, prompt templates for injection/exfiltration.
- Other outbound-call surfaces: `backend/app/ingestion/tasks.py`, notifications/webhooks under `backend/app/notifications/*`.
- Secrets/config: `.env*` handling, secret loading patterns, config file hygiene under `config/`.
