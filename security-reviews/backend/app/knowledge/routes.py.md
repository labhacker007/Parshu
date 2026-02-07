# Security Review: `backend/app/knowledge/routes.py`

Reviewed: 2026-02-02

## Key risks found

### 1) Knowledge base data exposure to any authenticated user (High)

**What was happening**
- Admin/global knowledge endpoints allowed any authenticated user to:
  - list all documents (`GET /knowledge/`)
  - fetch document details/content/chunks (`GET /knowledge/{doc_id}` and `/content`)
  - search the knowledge base (`POST /knowledge/search`)

**Why it matters**
- The knowledge base is a high-value target and can contain internal docs, playbooks, and sensitive operational content.
- Exposing raw chunks enables straightforward data exfiltration via query-driven retrieval.

**Fix**
- Admin/global KB operations now require `manage:knowledge`.
- Document detail/content endpoints enforce:
  - admin-managed docs require `manage:knowledge`
  - user docs require ownership
- Added a dedicated user-only endpoint `POST /knowledge/user/search` that searches only the caller’s personal documents.

### 2) Path traversal / arbitrary file write via uploaded filename (High)

**What was happening**
- Upload used `file.filename` directly when building the storage path.

**Why it matters**
- A crafted filename containing path separators (`../`) can escape the intended directory and overwrite arbitrary files.

**Fix**
- Sanitized filenames and enforced that the resolved path stays under `KNOWLEDGE_STORAGE_PATH`.

### 3) Unsafe DB session reuse in background tasks (Medium/High)

**What was happening**
- Background tasks were passed the request-scoped DB session (`db`) and used it after the request returned.

**Why it matters**
- Can cause concurrency bugs, closed-session usage, and unpredictable failures.

**Fix**
- Background tasks now open their own DB session via `SessionLocal()`.

### 4) Exception detail leakage (Medium)

**Fix**
- Sanitized selected error responses to avoid returning raw exception strings.

## Validation

- Added regression tests for KB authorization boundaries: `backend/tests/test_knowledge_authz.py`.
- Full backend test suite: `backend/.venv310/Scripts/python -m pytest -q` (passes as of 2026-02-02).
