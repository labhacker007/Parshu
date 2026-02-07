# Security Review: `backend/app/users/feeds.py`

Scope: SSRF risk from user-controlled feed URLs, authorization boundaries, and abuse/DoS resistance.

## Findings (what to fix)

### 1) Any authenticated user can trigger SSRF via `POST /users/feeds/validate-url` (High)
**What I see**
- `validate_feed_url()` fetches the provided `url` using `httpx.AsyncClient(..., follow_redirects=True)`.
- There is no scheme/host/IP validation or allowlist.

**Why it matters**
- This is a classic SSRF-as-a-service endpoint available to all authenticated users.
- Attackers can probe internal services, metadata endpoints, or localhost from the backend network.

**Fix**
- Apply the same SSRF guard used for ingestion/crawling:
  - block private/link-local/loopback ranges and metadata IPs
  - restrict ports
  - validate every redirect hop or disallow redirects
- Add strict rate limiting for this endpoint.

**Acceptance criteria**
- Requests to internal targets are blocked even if the user is authenticated.

---

### 2) User feed ingestion likely performs unguarded outbound fetches (High)
**What I see**
- Feed ingestion code fetches the feed URL and processes entries (the module contains “fetch/ingest” flows).
- No centralized safe-fetch helper is evident in this file.

**Why it matters**
- User-controlled feed URLs can be used for SSRF and for forcing the backend to download large bodies repeatedly.

**Fix**
- Ensure all outbound fetches in user-feed ingestion flow use a safe-fetch helper with allowlist/denylist rules and size caps.
- Consider restricting user feeds to `http(s)` and public domains only, or implement admin-approved allowlists for enterprise deployments.

**Acceptance criteria**
- User feed ingestion cannot access private IP ranges or internal DNS names.

---

### 3) Excessive error detail returned to clients (Medium)
**What I see**
- Exceptions are returned as `detail=f\"Failed to ingest feed: {error_detail}\"`.

**Why it matters**
- Error strings can leak internal hostnames, IPs, library versions, and parsing details helpful to attackers.

**Fix**
- Return a generic error message to clients.
- Log detailed exceptions server-side with correlation IDs.

**Acceptance criteria**
- Client errors do not include raw exception text.

