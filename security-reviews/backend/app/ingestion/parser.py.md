# Security Review: `backend/app/ingestion/parser.py`

Scope: SSRF risk in feed/article enrichment, outbound request safety, and availability controls during ingestion.

## Findings (what to fix)

### 1) SSRF via `fetch_og_image()` and `fetch_published_date()` (High)
**What I see**
- Both helpers call `requests.get(url, allow_redirects=True)` on the provided `url`.
- There is no restriction/validation beyond basic parsing used for image heuristics.

**Why it matters**
- If any attacker-controlled input can reach these functions (malicious feed entry URLs, user-submitted sources, compromised RSS), the backend can be coerced into fetching internal targets (metadata services, internal admin panels, localhost).
- Redirects make bypasses easier.

**Fix**
- Introduce a shared “safe fetch” layer (single implementation) that:
  - validates scheme, host, and resolved IP ranges (block loopback/private/link-local)
  - enforces an allowlist (preferred) for feed/article fetches
  - rejects cross-host redirects or validates each hop
- Ensure both functions use the safe fetch helper.

**Acceptance criteria**
- Requests to `127.0.0.1`, `169.254.169.254`, private ranges, or non-allowlisted domains are blocked.

---

### 2) No response size limits when fetching HTML (Medium/High)
**What I see**
- Uses `response.text` from `requests` without a byte cap.

**Why it matters**
- A malicious endpoint can return huge bodies to exhaust memory/CPU during ingestion.

**Fix**
- Use streaming requests with a max-bytes cap, or enforce `Content-Length` + streamed cutoff.

**Acceptance criteria**
- Oversized responses are rejected without high memory usage.

---

### 3) Redirect handling is not constrained (Medium)
**What I see**
- `allow_redirects=True` without validating redirect target host/IP.

**Why it matters**
- Open redirects and multi-hop redirects are a common SSRF bypass.

**Fix**
- Disable redirects or follow manually with per-hop validation.

**Acceptance criteria**
- Redirects to different hosts (or blocked IP ranges) are refused.

