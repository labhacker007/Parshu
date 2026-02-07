# Security Review: `infra/k8s-manifests.yaml`

Scope: Kubernetes infrastructure security (secrets handling, network exposure, pod security, supply chain, persistence).

## Findings (what to fix)

### 1) Secrets and credentials are hard-coded / misused (Critical)
**What I see**
- ConfigMap contains `DATABASE_URL` with credentials: `postgresql://orion_user:orion_pass@...`
- Secret contains `SECRET_KEY: "change-me-in-production"` (weak placeholder).
- Postgres password is wired to `orion-secrets:SECRET_KEY` (wrong secret used as DB password).

**Why it matters**
- Credentials in ConfigMaps are not treated as secrets and are broadly readable in many clusters.
- Weak/default secrets are routinely exploited.
- Miswiring secrets leads to accidental credential reuse and weak DB auth.

**Fix**
- Move DB credentials into a dedicated Secret (`POSTGRES_PASSWORD`), not `SECRET_KEY`.
- Remove credentials from ConfigMaps; use `valueFrom.secretKeyRef` for sensitive values.
- Require real secrets (no placeholders) for any non-dev deployment.

**Acceptance criteria**
- No credentials exist in ConfigMaps.
- Postgres password and app secret key are distinct and stored in Secrets.

---

### 2) Public exposure of backend and frontend via `LoadBalancer` (High)
**What I see**
- `Service/backend` is `type: LoadBalancer`.
- `Service/frontend` is `type: LoadBalancer`.

**Why it matters**
- Exposes the API directly to the internet unless the cluster/network blocks it.
- Often bypasses intended ingress controls (WAF, auth, TLS termination, rate limiting).

**Fix**
- Use an Ingress controller (or Gateway API) with TLS and WAF policy.
- Keep backend service `ClusterIP` and expose only via ingress (or internal LB) as needed.

**Acceptance criteria**
- Backend is not publicly reachable except through the intended ingress path.

---

### 3) No pod/container security context hardening (High)
**What I see**
- No `securityContext` on pods/containers (non-root, seccomp, dropped caps, read-only FS).

**Why it matters**
- If the app is compromised, the attacker has more privileges inside the container than necessary.

**Fix**
- Add hardened defaults:
  - `runAsNonRoot: true`
  - `allowPrivilegeEscalation: false`
  - `readOnlyRootFilesystem: true` (where compatible)
  - `capabilities: { drop: ["ALL"] }`
  - `seccompProfile: { type: RuntimeDefault }`

**Acceptance criteria**
- Pods run non-root and cannot gain new privileges.

---

### 4) No NetworkPolicies (High)
**What I see**
- No network segmentation between frontend/backend/postgres/redis.

**Why it matters**
- Lateral movement is trivial inside the namespace.
- SSRF bugs become far more damaging if pods can reach everything.

**Fix**
- Apply NetworkPolicies:
  - Frontend → backend only
  - Backend → postgres/redis only
  - Deny all other east-west traffic by default

**Acceptance criteria**
- Only required service-to-service paths are permitted.

---

### 5) Supply-chain risks: `latest` images and missing digest pinning (Medium)
**What I see**
- Backend and frontend images use `:latest` tags.

**Why it matters**
- Non-reproducible deployments and harder incident response.

**Fix**
- Pin images by digest (preferred) or immutable version tags.
- Enforce image provenance/signature verification if available.

**Acceptance criteria**
- Deployed images are immutable and reproducible.

---

### 6) Postgres persistence uses `emptyDir` (Availability/Data Integrity) (Medium)
**What I see**
- Postgres mounts `emptyDir: {}` for data.

**Why it matters**
- Data is lost when the pod is rescheduled.

**Fix**
- Use a PersistentVolumeClaim (PVC) and appropriate storage class.

**Acceptance criteria**
- Postgres data survives pod restarts/reschedules.

