# Security Review: `backend/app/reports/routes.py`

Reviewed: 2026-02-02

## Key risks found

### 1) Authorization bypass risk via manual role checks (High)

**What was happening**
- Some sensitive actions (edit/publish/unpublish) used `Depends(get_current_user)` plus ad-hoc role string checks (e.g. `if current_user.role not in ["ADMIN", "TI"]`).

**Why it matters**
- Bypasses the centralized `require_permission(...)` enforcement layer.
- Is brittle (enum-vs-string comparisons can silently fail during refactors).

**Fix**
- Switched sensitive endpoints to centralized permission enforcement:
  - `PATCH /reports/{report_id}` requires `edit:reports`
  - `POST /reports/{report_id}/publish` and `/unpublish` require `publish:reports`

### 2) Missing explicit permissions for report editing/publishing (Medium)

**What was happening**
- The permission registry lacked `edit:reports` and `publish:reports`, encouraging route-level special cases.

**Fix**
- Added `EDIT_REPORTS` and `PUBLISH_REPORTS` to the API permission enum and role mappings (see `backend/app/auth/rbac.py`).

### 3) Stored XSS in HTML export (High)

**What was happening**
- `GET /reports/{report_id}/export/html` built HTML via f-strings using values that can be influenced by users or admins:
  - `report.title`, `report.content`
  - branding values like `company_name`, `company_logo_url`, `confidentiality_notice`, and theme colors
- Inline markdown link handling could emit attacker-controlled URLs directly into `href="..."`.
- Report type was interpolated into a CSS class without validation.

**Why it matters**
- A malicious report title/content could execute JavaScript when an analyst/admin views the exported HTML (stored XSS).
- `javascript:` links / attribute injection could lead to account takeover, data exfiltration, or privileged actions via the user’s session.

**Fix**
- Added output-encoding and strict sanitizers inside `export_report_html()`:
  - HTML-escaped `report.title`, branding strings, and article titles
  - Blocked unsafe `href` schemes (only `http`, `https`, or relative) and rejected URLs containing quotes/whitespace/control chars
  - Restricted logo `src` to `http(s)` or `data:image/*`
  - Sanitized theme colors before injecting into CSS
  - Validated `report_type` before using it as a CSS class
- Ensured links include `rel="noopener noreferrer"` for `target="_blank"` anchors.

### 4) CSV/Excel formula injection in CSV export (Medium/High)

**What was happening**
- `GET /reports/{report_id}/export/csv` emitted user-controlled fields (report title, article title, URLs, IOC values, summaries) directly into CSV cells.

**Why it matters**
- When opened in Excel/Google Sheets, cells beginning with `=`, `+`, `-`, or `@` can be interpreted as formulas (CSV injection), enabling data exfiltration or user-driven command execution via spreadsheet features.

**Fix**
- Added a `_csv_safe(...)` helper that prefixes dangerous leading characters with an apostrophe (`'`) before writing cells.

## Validation

- Added/ran a regression test ensuring non-privileged users cannot edit/publish reports: `backend/tests/test_reports_authz.py`.
- Added/ran an XSS regression test for HTML export: `backend/tests/test_reports_export_xss.py`.
- Added/ran a CSV injection regression test: `backend/tests/test_reports_export_csv_injection.py`.
- Full backend test suite: `backend/.venv310/Scripts/python -m pytest -q` (passes as of 2026-02-02).
