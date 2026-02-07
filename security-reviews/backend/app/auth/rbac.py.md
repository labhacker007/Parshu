# Security Review: `backend/app/auth/rbac.py`

Reviewed: 2026-02-02

## Key risks found

### 1) Missing permissions for sensitive actions (Medium)

**What was happening**
- The API permission enum did not include explicit permissions for report editing/publishing, leading to ad-hoc authorization logic in routes.

**Fix**
- Added:
  - `edit:reports`
  - `publish:reports`
- Updated the TI role mapping to include these permissions.

## Notes

- This file is a critical “source-of-truth” for API permissions after consolidating checks in `backend/app/auth/dependencies.py`.
