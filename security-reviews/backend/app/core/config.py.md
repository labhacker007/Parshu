# Security Review: `backend/app/core/config.py`

Scope: secrets management, insecure defaults, and configuration-driven security posture.

## Findings (what to fix)

### 1) Hard-coded default credentials and secrets (High)
**What I see**
- `DATABASE_URL` defaults to `postgresql://app_user:app_pass@postgres:5432/app_db`
- `SECRET_KEY` defaults to `dev-secret-key-change-in-production-minimum-32-chars`

**Why it matters**
- Defaults like these frequently leak into “real” deployments (demos, shared dev, CI, quick cloud runs).
- If an attacker can reach the DB/Redis services, weak defaults become instant compromise.

**Fix**
- Remove credential-bearing defaults from code:
  - Use `Optional[str] = None` and fail-fast if missing.
- Keep dev defaults in `.env.example` / `docker-compose.dev.yml`, not in application code.

**Acceptance criteria**
- App refuses to start when `DATABASE_URL` or `SECRET_KEY` are missing (unless an explicit `ALLOW_INSECURE_DEV_DEFAULTS=true` is set for local dev only).

---

### 2) “Production mode” detection depends on `DEBUG` env parsing (Medium)
**What I see**
- `DEBUG` is derived via `os.getenv(...).lower() == "true"` instead of letting `BaseSettings` parse types.
- Security validation is conditional on `if not self.DEBUG`.

**Why it matters**
- Mis-set `DEBUG` can silently change security posture (e.g., HSTS, secret validation behavior).

**Fix**
- Let `pydantic-settings` handle boolean parsing:
  - `DEBUG: bool = False`
- Use an explicit `ENV` variable (`ENV=dev|staging|prod`) for behavior differences instead of `DEBUG` alone.

**Acceptance criteria**
- Security validations are gated by an explicit environment setting, not only by `DEBUG`.

---

### 3) Provider endpoints and allowlists must be enforced where used (Medium)
**What I see**
- `SSRF_ALLOWLIST_DOMAINS` exists as a comma-separated string.
- Multiple components perform outbound HTTP requests (feeds, knowledge crawler, GenAI provider checks).

**Why it matters**
- A config allowlist that is not consistently enforced is a false sense of security.

**Fix**
- Centralize SSRF protections:
  - Parse allowlist into a validated set at startup.
  - Provide a single “safe fetch” helper that enforces scheme/host/IP rules.
- Ensure every network fetch path uses the helper.

**Acceptance criteria**
- A unit test demonstrates blocked access to loopback/link-local/private ranges (as appropriate) and blocked protocols.

---

### 4) `OLLAMA_BASE_URL` default points to host gateway (Medium)
**What I see**
- Default `OLLAMA_BASE_URL` is `http://host.docker.internal:11434`.

**Why it matters**
- Encourages container → host network access patterns that become dangerous outside single-user dev.

**Fix**
- Move this default to dev-only config.
- For non-dev, require explicit configuration and/or run Ollama as a service in the same network.

**Acceptance criteria**
- Production config does not rely on `host.docker.internal`.

