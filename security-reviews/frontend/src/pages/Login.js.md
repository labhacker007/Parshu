# Security Review: `frontend/src/pages/Login.js`

Reviewed: 2026-02-02

## Key risks found

### 1) SSO token handling only supported query-string tokens (High)

**What was happening**
- The Login page only parsed SSO `access_token` / `refresh_token` from `location.search` (query params).

**Why it matters**
- Query-string tokens are vulnerable to leakage through logs, referrers, and browser history sync.

**Fix**
- Login now accepts tokens from either:
  - query params (backward compatibility), or
  - URL fragment (`location.hash`) (preferred / safer).

## Notes

- Backend SAML ACS now redirects with tokens in the fragment.
