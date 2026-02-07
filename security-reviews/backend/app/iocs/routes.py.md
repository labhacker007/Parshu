# Security Review: `backend/app/iocs/routes.py`

Reviewed: 2026-02-02

## Key risks found

### 1) Raw exception details returned to clients (Medium)

**What was happening**
- Several endpoints returned `detail=f"... {str(e)}"` on internal errors.

**Why it matters**
- Leaks implementation details that can help attackers (DB errors, parsing failures, stack-context hints).

**Fix**
- Replaced these with generic error messages while keeping detailed logging server-side.
