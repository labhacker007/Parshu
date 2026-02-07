# Security Review: `infra/Dockerfile.backend`

Scope: container hardening, secrets exposure risk, dependency/supply-chain hygiene.

## Findings (what to fix)

### 1) Container runs as root (High)
**What I see**
- No `USER` directive; default user is root.

**Why it matters**
- Any RCE in the app becomes root-in-container immediately, increasing blast radius (easier file tampering, package installs, persistence, and container escape attempts).

**Fix**
- Create and switch to a non-root user (and ensure the app can read only what it needs):
  - Create `app` user/group with a fixed UID/GID.
  - `chown` `/app` (or only the writable subpaths).
  - `USER app`.
- Combine with runtime hardening in Compose/K8s (`no-new-privileges`, `readOnlyRootFilesystem`, `capDrop`, seccomp).

**Acceptance criteria**
- `docker run … id` returns a non-root UID.
- App still starts and can write only to explicitly intended paths (e.g. `/tmp`).

---

### 2) Build tools and extra packages are shipped in the runtime image (Medium/High)
**What I see**
- Installs `gcc` (build toolchain) and `curl` into the final image.

**Why it matters**
- Unnecessary packages increase attack surface and make post-exploit tooling easier.
- `gcc` is usually only needed to build wheels; it should not be in the runtime image.

**Fix**
- Use a multi-stage build:
  - **builder stage**: `build-essential`/`gcc` + `pip wheel` or a virtualenv.
  - **runtime stage**: copy only wheels/venv and the app code.
- If `curl` is only for healthchecks, consider using a minimal healthcheck approach (or keep it but document why).

**Acceptance criteria**
- Final image does not include a compiler/toolchain.
- `dpkg -l` in runtime image is minimal and justified.

---

### 3) Python dependency supply-chain controls are weak (Medium)
**What I see**
- `pip install -r requirements.txt` without hashes and without explicit version pinning guarantees (depends on `backend/requirements.txt`).
- Base image `python:3.11-slim` is not pinned by digest.

**Why it matters**
- Builds can become non-reproducible and vulnerable to dependency confusion/typosquatting or upstream compromise.
- Tag-based base images can change over time.

**Fix**
- Pin base image by digest for production builds.
- Pin Python dependencies to exact versions, and consider:
  - `pip install --require-hashes -r requirements.txt` (with a hashed lockfile)
  - Or `pip-tools` / `poetry` lockfile, enforced in CI.
- Add CI checks for known CVEs (e.g. `pip-audit`, `safety`, or your SCA tooling).

**Acceptance criteria**
- Two builds from the same commit produce the same dependency set.
- CI fails if dependency hashes/lockfile drift unexpectedly.

---

### 4) Test code is copied into the runtime image (Low/Medium)
**What I see**
- `COPY backend/tests /app/backend/tests`

**Why it matters**
- Tests can include fixtures, sample credentials, internal endpoints, and debugging helpers.
- Increases image size and disclosure surface.

**Fix**
- Do not copy tests into the runtime image.
- If you need tests in CI, run them in the builder stage or a dedicated test image.

**Acceptance criteria**
- Runtime image contains only code needed to run the service.

---

### 5) `config/` copied into image (potential secrets leak) (Medium)
**What I see**
- `COPY config /app/config`

**Why it matters**
- If `config/` ever contains environment-specific secrets, API keys, or internal endpoints, those become baked into the image and leak via registry access.

**Fix**
- Ensure `config/` contains only non-sensitive defaults.
- Move sensitive config to runtime env vars, mounted secrets, or a secret manager.
- Add a repo guardrail: `rg`/CI check to prevent committing secrets under `config/`.

**Acceptance criteria**
- No secrets are present in built images or under `config/` in git history.

---

### 6) Healthcheck uses Python `requests` (Low)
**What I see**
- `HEALTHCHECK ... python -c "import requests; requests.get(...)"`.

**Why it matters**
- Healthcheck may fail if `requests` isn’t installed, and it adds avoidable complexity.

**Fix**
- Prefer `curl -f http://localhost:8000/health` (if `curl` is kept), or implement a tiny built-in check in the app process.

**Acceptance criteria**
- Healthcheck works consistently and does not require nonessential dependencies.

