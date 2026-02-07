# Security Review: `backend/app/routers/__init__.py`

Reviewed: 2026-02-02

## Key risks found

### 1) Weak password acceptance on registration (Medium)

**What was happening**
- `/auth/register` accepted any password value without a minimum length.

**Why it matters**
- Weak passwords increase account takeover risk, especially if MFA is not enforced everywhere.

**Fix**
- Enforced a basic password policy: minimum **12 characters** for `/auth/register`.

### 2) DoS risk from unconditional sleep in login path (Medium)

**What was happening**
- `/auth/login` intentionally slept to reduce timing differences.

**Why it matters**
- Sleeping per request can reduce throughput and makes the endpoint more susceptible to trivial request-flood DoS.

**Fix**
- Replaced sleep-based timing equalization with a “dummy password verify” using `DUMMY_PASSWORD_HASH`.

## Validation

- Backend test suite updated and passing: `backend/.venv310/Scripts/python -m pytest -q` (as of 2026-02-02).
