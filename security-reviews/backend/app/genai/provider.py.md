# Security Review: `backend/app/genai/provider.py`

Scope: GenAI provider abstraction, secret handling (API keys), outbound call safety (SSRF), and availability controls.

## Findings (what to fix)

### 1) DB-stored secrets use encryption key derived from `SECRET_KEY` (High)
**What I see**
- `get_config_value()` decrypts `SystemConfiguration` values using a Fernet key derived from `settings.SECRET_KEY[:32].ljust(...)`.
- On decrypt failure it returns ciphertext “as-is”.

**Why it matters**
- Key reuse with JWT signing secret complicates rotation and increases blast radius.
- Fail-open decryption can cause ciphertext to be used as API keys, leading to confusing behavior and potential leakage via error paths.

**Fix**
- Use a dedicated `CONFIG_ENCRYPTION_KEY` (or HKDF-derived per-purpose keys) and include key-id/versioning.
- Fail closed on decrypt errors and surface a clear “needs re-save” signal.

**Acceptance criteria**
- Encryption key material is separate from JWT signing secret and supports rotation.

---

### 2) Configurable `OLLAMA_BASE_URL` creates SSRF/egress risk (Med/High)
**What I see**
- `OllamaProvider` posts to `f\"{self.base_url}/api/generate\"`.
- There is no validation of `base_url`.

**Why it matters**
- If an attacker can influence provider configuration (admin takeover, misconfig), this becomes an outbound request primitive to arbitrary hosts.

**Fix**
- Validate `OLLAMA_BASE_URL`:
  - enforce http/https scheme
  - block private/link-local/loopback ranges unless explicitly allowed for local dev
  - optionally allowlist hostnames
- Add infrastructure egress controls (NetworkPolicy/SG/proxy) as defense in depth.

**Acceptance criteria**
- Provider base URLs cannot be set to internal metadata services or localhost in production.

---

### 3) Potential sensitive logging (Low/Medium)
**What I see**
- Logs `ollama_provider_initialized` with `base_url`.

**Why it matters**
- Internal URLs can be sensitive in some environments.

**Fix**
- Log redacted hostnames or omit `base_url` from info logs in non-debug.

**Acceptance criteria**
- Production logs do not disclose internal-only endpoints unnecessarily.

---

### 4) Long timeouts can tie up workers (Availability) (Medium)
**What I see**
- Ollama calls use `timeout=120s`.

**Why it matters**
- High concurrency + long timeouts can exhaust worker threads/event loop capacity.

**Fix**
- Enforce tighter timeouts + circuit breaking + per-user rate limits on GenAI endpoints.

**Acceptance criteria**
- Under provider slowness, the service degrades gracefully and remains responsive.

