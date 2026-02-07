# Security Review: `backend/app/users/routes.py`

Reviewed: 2026-02-02

## Key risk found

### Permission contract mismatch → “false confidence” RBAC (Medium/High)

**What was happening**
- `/users/my-permissions` returned `api_permissions`, but the frontend permissions hook expects `all_permissions`.
- This made the client-side permission list empty in normal operation, which can lead to inconsistent UI gating and operator confusion.

**Fix**
- `/users/my-permissions` now returns:
  - `api_permissions` (backward compatible)
  - `all_permissions` (preferred, matches frontend contract)

## Validation

- Regression test: `backend/tests/test_permissions_endpoints.py`.
- Full backend test suite: `backend/.venv310/Scripts/python -m pytest -q` (passes as of 2026-02-02).

