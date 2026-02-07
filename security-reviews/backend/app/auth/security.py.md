# Security Review: `backend/app/auth/security.py`

Reviewed: 2026-02-02

## Key risks found

### 1) Login timing side-channel surface (Low/Medium)

**What was happening**
- Timing equalization was handled in the login handler (see `backend/app/routers/__init__.py`) by an unconditional sleep.

**Why it matters**
- Artificial sleeps in request handlers can amplify DoS risk under load.

**Fix**
- Added a module-level `DUMMY_PASSWORD_HASH` to support a low-overhead “dummy verify” pattern in the login handler.

## Code changes

- Added `DUMMY_PASSWORD_HASH` computed once at import time for consistent dummy verification.

## Validation

- Covered indirectly by login flow tests (see `backend/tests/test_auth_flow.py`).
