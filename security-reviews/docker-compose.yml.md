# Security Review: `docker-compose.yml`

Scope: application security, IAM/secrets handling, network exposure, container hardening, and supply-chain hygiene for local Compose.

This file is explicitly dev-oriented (live reload, defaults). The main security risk is “dev config accidentally becomes prod config” (or is run on a shared/hosted machine), exposing databases, weak secrets, and debug surfaces.

## Findings (what to fix)

### 1) Default DB credentials + default `SECRET_KEY` (High)
**What I see**
- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` all have insecure defaults (`app_user` / `app_pass`).
- `SECRET_KEY` has a predictable default (`dev-secret-key-change-in-production-minimum-32-chars`).
- `DATABASE_URL` embeds credentials and is assembled from the above defaults.

**Why it matters**
- If this stack is run anywhere other than an isolated dev laptop (shared workstation, CI runner, cloud VM), the database becomes trivial to access.
- A predictable/weak `SECRET_KEY` can compromise session signing, auth tokens, CSRF, password reset tokens, etc. (depending on how the backend uses it).

**Fix**
- Remove credential defaults in Compose (force explicit configuration).
- Use a non-committed `.env` for local dev and a secret manager (or Compose secrets) for anything beyond local dev.
- Make backend **fail fast** on startup when `SECRET_KEY` is missing/too short, and when `ADMIN_PASSWORD` is empty if admin bootstrap is enabled.

**Acceptance criteria**
- `docker compose up` fails with a clear error if `SECRET_KEY` is missing/weak.
- No default password exists in any shipped Compose file.
- Credentials are not hard-coded into the Compose file (beyond referencing env vars or secrets).

---

### 2) Postgres and Redis are exposed on all host interfaces (High)
**What I see**
- `postgres` publishes `5432:5432`
- `redis` publishes `6379:6379`

**Why it matters**
- Publishing without a host IP binds to `0.0.0.0` by default, making services reachable from other machines on the same network (and sometimes beyond, depending on host firewall).
- Redis commonly runs without auth in dev; that becomes remote RCE/data exfiltration risk if exposed.

**Fix (choose one)**
1) **Best**: remove `ports:` for `postgres` and `redis` entirely (keep them private to the Compose network).
2) If you need host access for local tooling, bind to loopback only:
   - `127.0.0.1:5432:5432`
   - `127.0.0.1:6379:6379`

**Acceptance criteria**
- From another machine on the LAN, `5432` and `6379` are unreachable.
- Only the backend can reach Postgres/Redis over the internal Docker network.

---

### 3) Debug + live reload enabled for backend by default (Medium)
**What I see**
- `DEBUG` defaults to `true`.
- Backend runs `uvicorn ... --reload`.

**Why it matters**
- Debug mode can leak stack traces, secrets in error messages, and internal endpoints.
- Reload watchers increase attack surface and can behave badly with mounted volumes.

**Fix**
- Split into `docker-compose.dev.yml` and `docker-compose.prod.yml`, or use Compose `profiles`:
  - `profiles: ["dev"]` on dev-only settings (reload, volume mounts, `DEBUG=true`).
  - Ensure prod uses `DEBUG=false`, no `--reload`, and immutable images (no source bind mounts).

**Acceptance criteria**
- Production Compose (or the default Compose) does not enable debug/reload.

---

### 4) Container can reach host services via `host-gateway` (Medium)
**What I see**
- `backend.extra_hosts` sets `host.docker.internal:host-gateway`
- `OLLAMA_BASE_URL` points to `http://host.docker.internal:11434`

**Why it matters**
- This intentionally enables container → host connectivity, which is a common lateral-movement path if the backend is compromised.

**Fix (preferred)**
- Run Ollama as a container/service in the same Compose project/network and remove `extra_hosts`.
- If you keep host access, make it explicitly dev-only via `profiles: ["dev"]`.

**Acceptance criteria**
- Non-dev deployments do not require container → host access.

---

### 5) Missing container hardening knobs (Medium)
**What I see**
- No `read_only`, no `cap_drop`, no `security_opt: ["no-new-privileges:true"]`, no `pids_limit`, no `tmpfs` for writable temp.
- No explicit non-root `user` for the `backend`/`frontend` containers (depends on Dockerfiles, but Compose isn’t enforcing it).

**Why it matters**
- If the app is compromised, the attacker gets broader container privileges and more writable surface than necessary.

**Fix**
- For `backend` and `frontend`, add (where compatible):
  - `read_only: true`
  - `tmpfs: ["/tmp"]`
  - `security_opt: ["no-new-privileges:true"]`
  - `cap_drop: ["ALL"]` (then add back only what’s required)
  - `user: "<nonroot uid:gid>"` (or ensure Dockerfile sets a non-root user)
- Add resource limits (DoS resistance) in non-dev environments.

**Acceptance criteria**
- App containers run as non-root.
- App containers are read-only except for explicit temp/cache paths.

---

### 6) Supply-chain pinning: image tags and `latest` model (Low/Medium)
**What I see**
- Images are tagged (`postgres:15-alpine`, `redis:7-alpine`) but not pinned by digest.
- Ollama model uses `llama3:latest`.

**Why it matters**
- Tags can be moved; digests are immutable. Pinning improves reproducibility and reduces supply-chain risk.
- `latest` changes behavior unexpectedly and complicates incident response.

**Fix**
- Pin runtime images by digest in production (optionally keep tags in dev).
- Replace `latest` with a specific model tag/version you have validated.

**Acceptance criteria**
- Production deployments use digests (or an internal registry mirror with immutability controls).
- No `latest` in production configuration.

---

## Recommended next file to review
Pick one of these next (highest impact):
- `infra/Dockerfile.backend` (container hardening, secrets, build hygiene)
- `backend/app/auth/page_permissions.py` (authorization model)
- `backend/app/genai/routes.py` (prompt injection, SSRF, data exfiltration)

