# Security Review Methodology (Repo-Wide)

Goal: identify security risks across application code, IAM/RBAC, network/SSRF, infrastructure, and containerization **before** implementing fixes.

## How we’re reviewing “all files”

This repo has ~293 tracked files. Doing a deep manual audit on every single file isn’t efficient, so the review is done in two passes:

1) **Triage pass (whole-repo)**
   - Automated keyword scans (secrets, authz, network calls, unsafe primitives).
   - Identify high-risk components and entry points (auth, admin, ingestion, GenAI, connectors, infra).
   - Produce a repo-wide checklist in `security-reviews/REVIEW_INDEX.md`.

2) **Deep review pass (file-by-file)**
   - For each high/medium risk file, produce a dedicated report under `security-reviews/<same path>.md`.
   - Add each concrete issue to `security-reviews/ISSUES.md` with severity + fix guidance.

## Severity definitions

- **Critical**: remote compromise likely (auth bypass/RCE/secret disclosure) or known unsafe exposure in default deploy.
- **High**: privilege escalation, SSRF, IDOR, sensitive data exposure, insecure defaults that are easy to ship to prod.
- **Medium**: defense-in-depth gaps, misconfigurations, hardening gaps, leakage of operational details.
- **Low**: hygiene and best-practice improvements with limited exploitability.

## What “done” means

We consider the review “done” when:
- All auth/authz entry points and admin endpoints are reviewed.
- All outbound network fetchers/connectors are reviewed for SSRF and credential handling.
- All write paths that accept user-controlled IDs/URLs/files are reviewed for IDOR/injection.
- All infra manifests and Dockerfiles are reviewed for secrets, exposure, and hardening.
- Frontend is reviewed for auth token storage, XSS/CSRF posture, and API client behavior.

