# Security Review: `backend/app/auth/saml.py`

Reviewed: 2026-02-02

## Key risks found

### 1) Token leakage via URL query parameters (High)

**What was happening**
- The SAML ACS redirect placed `access_token` and `refresh_token` in the **query string** (e.g. `/login?access_token=...`).

**Why it matters**
- Query parameters are commonly captured by:
  - reverse proxy / ingress logs
  - browser history sync
  - referrer headers (when navigating to other sites)
  - APM / error-reporting tools
- This can leak long-lived credentials (JWTs) outside the intended trust boundary.

**Fix**
- Redirect now places tokens in the **URL fragment** (e.g. `/login#access_token=...`) using `urlencode(...)`.
- The fragment is not sent to servers as part of the HTTP request, reducing accidental token exfiltration.

### 2) Exception detail returned to clients (Medium)

**What was happening**
- Some `HTTPException(... detail=f"... {str(e)}")` patterns returned raw exception messages.

**Why it matters**
- Leaks internal implementation details (stack context, library errors, configuration hints).

**Fix**
- Error responses are now generic (server logs still capture the exception).

## Code changes

- Token redirect moved from query params to fragment.
- Sanitized 500 error details for ACS and metadata generation.

## Validation

- Backend test suite: `backend/.venv310/Scripts/python -m pytest -q` (passes as of 2026-02-02).
