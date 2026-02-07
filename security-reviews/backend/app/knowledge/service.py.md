# Security Review: `backend/app/knowledge/service.py`

Reviewed: 2026-02-02

## Key risks found

### 1) Search scope not parameterizable (High)

**What was happening**
- `KnowledgeService.search(...)` searched across all READY/active documents without supporting “user-only” scope filtering.

**Why it matters**
- When exposed via APIs, this makes it easy to accidentally leak global/admin knowledge to unprivileged users.

**Fix**
- Added optional scope controls to `search(...)`:
  - `uploaded_by_id`
  - `include_admin_managed`
  - `include_user_managed`
- This enables routes to enforce “user-only” searches safely.
