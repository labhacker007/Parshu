# Security Scan Ledger (Jyoti branch)

Date: 2026-02-07  
Branch: `Jyoti`  
Scope: News/Feed standalone app (backend + frontend + infra)

## Tools & Commands Run
1. `npm audit --package-lock-only --omit=dev --json` (frontend SCA)
2. `python -m pip_audit -r security-reviews/artifacts/requirements.audit.txt --no-deps --disable-pip --progress-spinner off --timeout 20 -f json` (backend SCA)
3. `python -m bandit -r backend/app -f json -o security-reviews/artifacts/bandit-backend-app-2026-02-07.json` (backend SAST)

Artifacts:
- `security-reviews/artifacts/npm-audit-frontend-2026-02-07.json`
- `security-reviews/artifacts/pip-audit-backend-2026-02-07.json`
- `security-reviews/artifacts/bandit-backend-app-2026-02-07.json`
- `security-reviews/artifacts/requirements.audit.txt` (requirements sanitized for audit: removed duplicate `reportlab>=4.0` line so all pins are exact)

## Summary of Findings
### SCA (Dependency Vulnerabilities)
Backend `pip-audit` found **43 known vulnerabilities across 8 packages**. High priority upgrades recommended:
- `fastapi==0.104.1` -> upgrade to `>=0.109.1` (ReDoS via `python-multipart`)
- `python-multipart==0.0.6` -> upgrade to `>=0.0.22` (multiple DoS/path traversal advisories)
- `python-jose==3.3.0` -> upgrade to `>=3.4.0` (algorithm confusion, JWT bomb)
- `requests==2.31.0` -> upgrade to `>=2.32.4` (TLS verification + netrc leakage)
- `authlib==1.3.0` -> upgrade to `>=1.6.5` (JWS crit handling + DoS)
- `aiohttp==3.9.1` -> upgrade to `>=3.13.3` (multiple parser/request smuggling/DoS issues)
- `cryptography==41.0.7` -> upgrade to `>=43.0.1` (OpenSSL issues, PKCS12 crash)
- `pypdf==3.17.4` -> upgrade to `>=6.6.2` (multiple PDF parsing DoS issues)

Frontend `npm audit` (prod dependencies) reported **0 vulnerabilities**.

### SAST (Static Analysis)
`bandit` reported **24 low-severity findings**:
- `B110` (try/except/pass) x17
- `B112` (try/except/continue) x6
- `B105` (hardcoded password string) x1

These are primarily maintainability/observability risks and likely false positives (e.g., permission keys), but should still be reviewed for suppressed error handling.

### Manual Review (Targeted)
Potential XSS risk from `dangerouslySetInnerHTML` where content may be untrusted or insufficiently sanitized:
- `frontend/src/pages/NewsIntelImproved.js` (falls back to `raw_content`)
- `frontend/src/pages/NewsFeeds.js` (`formatSummaryAsHTML` turns AI output into HTML without sanitization)
- `frontend/src/components/ReportVersionControl.js` (renders stored report content without sanitization)

Recommendation: sanitize content on the backend and/or apply a trusted client-side sanitizer (e.g., DOMPurify) before rendering.

## DAST Status
Attempted to start the MyFeeds stack for DAST; backend failed to boot due to a missing module:
- `ModuleNotFoundError: No module named 'app.extraction'` from `backend/app/articles/routes.py`

DAST is blocked until the backend starts successfully. Plan once fixed:
1. Start stack (backend + frontend).
2. Run OWASP ZAP Baseline (or equivalent) against the backend API and frontend routes.
3. Capture report in `security-reviews/artifacts/`.

## Review Coverage
### Automated
- All Python code under `backend/app/**` (Bandit SAST)
- Frontend dependencies via `frontend/package-lock.json` (npm audit SCA)
- Backend dependencies via `backend/requirements.txt` (pip-audit SCA; sanitized copy)

### Manual (Targeted)
- `backend/app/auth/security.py`
- `backend/app/auth/dependencies.py`
- `backend/app/core/config.py`
- `backend/app/core/fetch.py`
- `backend/app/core/ssrf.py`
- `backend/app/ingestion/parser.py`
- `backend/app/integrations/sources.py`
- `backend/app/main.py`
- `frontend/src/pages/IntelNews.js`
- `frontend/src/pages/NewsIntel.js`
- `frontend/src/pages/NewsIntelImproved.js`
- `frontend/src/pages/NewsFeeds.js`
- `frontend/src/components/ReportVersionControl.js`

## Not Yet Reviewed (Manual)
- `backend/app/admin/**`
- `backend/app/articles/**`
- `backend/app/genai/**`
- `backend/app/notifications/**`
- `backend/app/watchlist/**`
- `frontend/src/components/**` (other than listed above)
- `frontend/src/api/**`
- `infra/**` (beyond high-level scan)

## Next Steps
1. Remediate dependency vulnerabilities in `backend/requirements.txt`.
2. Add HTML sanitization to all UI surfaces using `dangerouslySetInnerHTML`.
3. Execute DAST once the app is running and attach results to this ledger.
