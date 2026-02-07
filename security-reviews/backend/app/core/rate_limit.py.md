# Security Review: `backend/app/core/rate_limit.py`

Scope: availability/abuse controls (rate limiting), reverse-proxy safety, and DoS resilience.

## Findings (what to fix)

### 1) In-memory limiter is bypassable and unsafe for multi-worker deployments (Medium)
**What I see**
- Rate limiter state is stored in-process (`defaultdict(list)`).

**Why it matters**
- With multiple workers/replicas, each instance has its own counters → users can effectively multiply allowed rate by number of workers.
- Restarts reset limits.

**Fix**
- Use a shared store (Redis) and a well-tested limiter library (e.g., `slowapi` or `starlette-limiter`), or implement Redis-backed storage.

**Acceptance criteria**
- Rate limits hold across multiple workers/replicas.

---

### 2) Key includes raw request path → memory DoS via high-cardinality keys (High for availability)
**What I see**
- Key is `f\"{path}:{user_id or client_ip}\"` where `path = request.url.path`.

**Why it matters**
- Any endpoint that embeds IDs in the path (e.g. `/articles/123`) creates a unique limiter key per ID.
- An attacker can generate many unique paths to grow memory without bound and degrade the service.

**Fix**
- Normalize the path used for rate limiting:
  - Use route templates (preferred), or
  - Strip/replace high-entropy segments (numbers, UUIDs) with placeholders.
- Add periodic cleanup of empty/old keys.

**Acceptance criteria**
- Hitting `/resource/<many-ids>` does not grow limiter state linearly with ID count.

---

### 3) Client IP handling is not proxy-aware (Medium)
**What I see**
- Uses `request.client.host` as the IP.

**Why it matters**
- Behind a reverse proxy/load balancer, this becomes the proxy’s IP for all clients → everyone shares a limiter bucket.
- If you switch to `X-Forwarded-For` without strict proxy trust, it becomes spoofable.

**Fix**
- Use `ProxyHeadersMiddleware` (or equivalent) and configure trusted proxies.
- Derive client identity from a trusted header only when behind known proxies.

**Acceptance criteria**
- Rate limiting behaves correctly behind your deployment proxy without being spoofable.

