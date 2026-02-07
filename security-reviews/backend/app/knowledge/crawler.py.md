# Security Review: `backend/app/knowledge/crawler.py`

Scope: SSRF risk, outbound HTTP safety, credential handling, and availability controls for crawling.

## Findings (what to fix)

### 1) SSRF: arbitrary URL fetch without IP/range protections (High)
**What I see**
- `_is_valid_url()` only enforces `http/https` and (optionally) `same_domain_only`.
- There is no protection against:
  - loopback (`127.0.0.1`, `localhost`)
  - link-local (`169.254.0.0/16`)
  - RFC1918 private ranges
  - internal DNS names
  - DNS rebinding

**Why it matters**
- If users can supply `start_url`, they can make the backend fetch internal resources (cloud metadata, internal admin panels, other services).
- Even if “same-domain only” is enabled, a user can set the base domain to an internal host.

**Fix**
- Add a centralized SSRF guard for **every** outbound request:
  - Allowlist hostnames/domains where appropriate (preferred).
  - Resolve DNS and block private/link-local/loopback/multicast ranges.
  - Block non-HTTP schemes (already done) and also block unusual ports unless allowlisted.
  - Consider enforcing HTTPS-only for non-local allowlisted targets.

**Acceptance criteria**
- Attempts to crawl `http://127.0.0.1:...`, `http://169.254.169.254/...`, and private IPs are rejected.

---

### 2) Redirects can bypass same-domain checks (High)
**What I see**
- `_fetch_page()` calls `client.get(..., follow_redirects=True)` without re-validating the final redirect target.
- `_is_valid_url()` validates only the initial URL.

**Why it matters**
- A URL on the allowed domain can redirect to an internal host, and the crawler will follow it.
- This is a common SSRF bypass path even when domain checks exist.

**Fix**
- Disable cross-host redirects, or:
  - Follow redirects manually and validate each hop (host + IP restrictions).
- Re-run URL validation against `response.url` before processing content.

**Acceptance criteria**
- Redirects to a different host (or to blocked IP ranges) are refused.

---

### 3) No response size limits (availability risk) (Medium/High)
**What I see**
- Uses `response.text` without limiting bytes read.

**Why it matters**
- A malicious server can return very large responses to exhaust memory/CPU.

**Fix**
- Enforce maximum download size (bytes) and maximum pages/requests (already has `max_pages`, but size is unbounded).
- Prefer streaming reads with a hard cap.

**Acceptance criteria**
- Crawling a huge page fails gracefully and does not spike memory.

---

### 4) Credential leakage risk via auth headers/cookies (Medium)
**What I see**
- Crawler supports bearer tokens, basic auth, and session cookies and sends them to requested URLs.

**Why it matters**
- If start URL/links are attacker-controlled, credentials can be exfiltrated to attacker domains (especially if redirects are allowed).

**Fix**
- If auth is enabled, restrict crawling to a strict allowlist and disallow cross-host redirects.
- Never forward cookies/Authorization headers to a different host than the allowlisted host.

**Acceptance criteria**
- Auth headers are only sent to explicitly approved hosts.

