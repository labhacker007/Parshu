# Security Review: `backend/app/genai/routes.py`

Scope: application security (authz, input validation, data exposure), IAM (permissions), and GenAI-specific risks (SSRF/cost/abuse).

## Findings (what to fix)

### 1) “Admin” endpoints are callable by any authenticated user (High)
**What I see**
- `GET /genai/admin/configs` uses `Depends(get_current_user)` instead of an admin permission.
- `GET /genai/admin/models/available` also uses `Depends(get_current_user)` despite the `/admin/...` path.

**Why it matters**
- Any authenticated user can enumerate GenAI configuration and model metadata under an `/admin` namespace.
- Even if it “only” returns configuration parameters, it leaks operational details (cost controls, model choices, usage metrics) and sets a precedent for privilege mistakes in this module.

**Fix**
- Require an explicit permission for both endpoints, e.g.:
  - `require_permission("manage:genai")` for `/admin/configs`
  - a read-only permission (e.g. `require_permission("view:genai")`) for `/admin/models/available`, or move it out of `/admin` if it’s intended for all users.

**Acceptance criteria**
- Non-admin users receive `403` for `/genai/admin/configs`.
- Endpoint naming matches privilege: anything under `/admin` requires admin permissions.

---

### 2) Provider status endpoint leaks internal details to all users (Medium)
**What I see**
- `GET /genai/providers/status` returns:
  - `base_url` for Ollama
  - `has_api_key` / configured status for third-party providers
  - raw exception text in `providers["ollama"]["error"] = str(e)`

**Why it matters**
- Information disclosure: internal URLs, network error details, and “which providers are enabled” are useful to attackers and should generally be admin-only.
- Returning raw error strings can leak hostnames, IPs, stack details, and configuration hints.

**Fix**
- Restrict the endpoint to admins (or return a redacted view to non-admin users).
- Sanitize error fields:
  - log full exception server-side
  - return a generic status like `disconnected` without `str(e)` to non-admins.
- Avoid returning internal base URLs unless needed (and only to admins).

**Acceptance criteria**
- Regular users cannot see provider base URLs or raw connectivity errors.

---

### 3) Potential SSRF primitive via configurable provider URLs (Medium/High, design)
**What I see**
- The code makes outbound HTTP requests to `settings.OLLAMA_BASE_URL` (e.g. `GET {OLLAMA_BASE_URL}/api/tags`).

**Why it matters**
- If any admin UI / DB config / env management allows changing `OLLAMA_BASE_URL` at runtime, this becomes an SSRF foothold (internal port scanning, metadata services, intranet endpoints).
- “Admin-only” is not a complete mitigation; SSRF is commonly leveraged after account takeover.

**Fix**
- Validate provider base URLs:
  - enforce `http(s)` scheme only
  - deny link-local, loopback, RFC1918 (as appropriate for your deployment), and metadata IP ranges
  - optionally allowlist hostnames
- Add outbound egress controls at the infrastructure layer (network policy / security groups / proxy).

**Acceptance criteria**
- Attempts to set a provider base URL to blocked ranges are rejected.

---

### 4) User-controlled `model` selection on `/help` without an explicit allowlist check (Medium)
**What I see**
- `/genai/help` accepts `request.model` and passes it to `provider.generate(model=request.model, ...)`.

**Why it matters**
- If the provider layer does not enforce model allowlists and quotas per user/role, a user could:
  - force expensive models
  - bypass “enabled/approved” registry constraints
  - trigger unexpected provider behavior

**Fix**
- Validate `request.model` against a server-side allowlist for the current user/role (enabled + approved models only).
- If `model` is omitted, select the model server-side based on policy (role, quota, use-case).

**Acceptance criteria**
- A user cannot request an unapproved/disabled model identifier.

---

### 5) Cost/DoS guardrails are present but not obviously enforced at the route boundary (Low/Medium)
**What I see**
- Config schemas allow `max_tokens` up to `100000`, and timeouts up to `300s`.
- `/help` uses `max_tokens=500`, but admin configs could raise limits.

**Why it matters**
- Misconfiguration can cause runaway cost, timeouts, and worker exhaustion.

**Fix**
- Add hard server-side ceilings independent of per-config settings (defense in depth).
- Add rate limiting on GenAI endpoints per user (especially `/help`).
- Ensure quota checks occur before calling providers (not just tracked after the fact).

**Acceptance criteria**
- A single user cannot exhaust worker capacity or create unexpected provider spend via configuration alone.

