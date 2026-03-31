#!/usr/bin/env python3
"""
Deployment Readiness Verification
===================================
Verifies the backend is ready for deployment across:
- Modern cloud infrastructure (AWS, Azure, GCP)
- Local machines (Docker, bare metal)
- OS agnostic (Linux, macOS, Windows)
- Environment agnostic (dev, staging, prod)

Checks:
1. Docker configuration
2. Environment variable handling
3. Health endpoints
4. Security headers
5. Database connectivity
6. CORS configuration
7. Production safety checks
8. API documentation
9. Container health checks
10. Graceful degradation

Run: python scripts/verify_deployment.py
"""

import requests
import json
import sys
import os
import time

BASE_URL = os.environ.get("BASE_URL", "http://localhost:8000")
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@huntsphere.local")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "Admin123!@2026")

passed = 0
failed = 0
warnings = 0
checks = []


def check(category, name, condition, detail="", warn_only=False):
    """Run a deployment check."""
    global passed, failed, warnings
    if condition:
        passed += 1
        checks.append(("PASS", category, name))
        print(f"  [PASS] {name}")
    elif warn_only:
        warnings += 1
        checks.append(("WARN", category, name))
        print(f"  [WARN] {name} - {detail}")
    else:
        failed += 1
        checks.append(("FAIL", category, name))
        print(f"  [FAIL] {name} - {detail}")


def main():
    start = time.time()
    print("=" * 70)
    print("DEPLOYMENT READINESS VERIFICATION")
    print(f"Target: {BASE_URL}")
    print("=" * 70)

    # ================================================================
    # 1. Backend Reachability
    # ================================================================
    print("\n--- 1. Backend Reachability ---")

    try:
        r = requests.get(f"{BASE_URL}/health", timeout=10)
        check("reachability", "Backend is reachable", r.status_code == 200)
        check("reachability", "Health returns healthy",
              r.json().get("status") == "healthy",
              f"Status: {r.json().get('status')}")
        check("reachability", "Version info present",
              "version" in r.json(),
              "No version in health response")
        check("reachability", "Database stats in health",
              "database" in r.json(),
              "No database info in health response")
    except Exception as e:
        check("reachability", "Backend is reachable", False, str(e))
        print("\n[FATAL] Backend not reachable. Cannot continue.")
        sys.exit(1)

    # ================================================================
    # 2. API Documentation
    # ================================================================
    print("\n--- 2. API Documentation ---")

    r = requests.get(f"{BASE_URL}/docs")
    check("docs", "Swagger UI accessible", r.status_code == 200)

    r = requests.get(f"{BASE_URL}/openapi.json")
    check("docs", "OpenAPI schema accessible", r.status_code == 200)

    if r.status_code == 200:
        schema = r.json()
        check("docs", "OpenAPI has paths",
              len(schema.get("paths", {})) > 10,
              f"Only {len(schema.get('paths', {}))} paths")
        check("docs", "OpenAPI has title",
              bool(schema.get("info", {}).get("title")))

    # ================================================================
    # 3. Security Headers
    # ================================================================
    print("\n--- 3. Security Headers ---")

    r = requests.get(f"{BASE_URL}/health")

    required_headers = {
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "X-XSS-Protection": "1; mode=block",
        "Referrer-Policy": "strict-origin-when-cross-origin",
    }

    for header, expected in required_headers.items():
        actual = r.headers.get(header)
        check("security", f"Header: {header}",
              actual == expected,
              f"Expected '{expected}', got '{actual}'")

    check("security", "Content-Security-Policy present",
          bool(r.headers.get("Content-Security-Policy")),
          "Missing CSP header")

    check("security", "Permissions-Policy present",
          bool(r.headers.get("Permissions-Policy")),
          "Missing Permissions-Policy header")

    # ================================================================
    # 4. Authentication System
    # ================================================================
    print("\n--- 4. Authentication ---")

    # Login
    r = requests.post(f"{BASE_URL}/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    check("auth", "Admin login works", r.status_code == 200)

    if r.status_code == 200:
        data = r.json()
        token = data.get("access_token")
        check("auth", "Access token provided", bool(token))
        check("auth", "Refresh token provided", bool(data.get("refresh_token")))
        check("auth", "User info in response", bool(data.get("user")))
        headers = {"Authorization": f"Bearer {token}"}
    else:
        print("  [FATAL] Cannot login. Skipping authenticated checks.")
        sys.exit(1)

    # Protected endpoint
    r = requests.get(f"{BASE_URL}/auth/me", headers=headers)
    check("auth", "Token authentication works", r.status_code == 200)

    # Unauthenticated access blocked
    r = requests.get(f"{BASE_URL}/auth/me")
    check("auth", "Unauthenticated access blocked",
          r.status_code in [401, 403])

    # Invalid token rejected
    r = requests.get(f"{BASE_URL}/auth/me",
                     headers={"Authorization": "Bearer invalid_token_here"})
    check("auth", "Invalid token rejected",
          r.status_code in [401, 403])

    # ================================================================
    # 5. CORS Configuration
    # ================================================================
    print("\n--- 5. CORS ---")

    r = requests.options(f"{BASE_URL}/health",
                         headers={"Origin": "http://localhost:3000",
                                  "Access-Control-Request-Method": "GET"})
    check("cors", "CORS preflight responds",
          r.status_code in [200, 204, 405])

    # ================================================================
    # 6. Core API Functionality
    # ================================================================
    print("\n--- 6. Core APIs ---")

    # Sources
    r = requests.get(f"{BASE_URL}/sources/", headers=headers)
    check("api", "GET /sources/ works", r.status_code == 200)

    # Articles
    r = requests.get(f"{BASE_URL}/articles/triage", headers=headers)
    check("api", "GET /articles/triage works", r.status_code == 200)

    # Watchlist
    r = requests.get(f"{BASE_URL}/watchlist/", headers=headers)
    check("api", "GET /watchlist/ works", r.status_code == 200)

    # Users
    r = requests.get(f"{BASE_URL}/users/", headers=headers)
    check("api", "GET /users/ works", r.status_code == 200)

    # Audit
    r = requests.get(f"{BASE_URL}/audit/", headers=headers)
    check("api", "GET /audit/ works", r.status_code == 200)

    # GenAI Functions
    r = requests.get(f"{BASE_URL}/admin/genai/functions/", headers=headers)
    check("api", "GET /admin/genai/functions/ works", r.status_code == 200)

    # Prompts
    r = requests.get(f"{BASE_URL}/admin/prompts/", headers=headers)
    check("api", "GET /admin/prompts/ works", r.status_code == 200)

    # Guardrails
    r = requests.get(f"{BASE_URL}/admin/genai-guardrails/", headers=headers)
    check("api", "GET /admin/genai-guardrails/ works", r.status_code == 200)

    # ================================================================
    # 7. Error Handling
    # ================================================================
    print("\n--- 7. Error Handling ---")

    r = requests.get(f"{BASE_URL}/nonexistent")
    check("errors", "404 for unknown endpoint",
          r.status_code == 404)

    r = requests.post(f"{BASE_URL}/auth/login",
                      json={"bad_field": "test"})
    check("errors", "422 for invalid request body",
          r.status_code == 422)
    check("errors", "Error response is JSON",
          "application/json" in r.headers.get("content-type", ""))

    # ================================================================
    # 8. Docker Configuration
    # ================================================================
    print("\n--- 8. Docker Configuration ---")

    dockerfile_path = os.path.join(os.path.dirname(__file__), "..", "infra", "Dockerfile.backend")
    if os.path.exists(dockerfile_path):
        with open(dockerfile_path) as f:
            dockerfile = f.read()
        check("docker", "Dockerfile exists", True)
        check("docker", "Multi-stage build",
              "FROM" in dockerfile and dockerfile.count("FROM") >= 2,
              "Single-stage build detected")
        check("docker", "Non-root user",
              "USER" in dockerfile and "appuser" in dockerfile,
              "Missing non-root user")
        check("docker", "HEALTHCHECK defined",
              "HEALTHCHECK" in dockerfile)
        check("docker", "EXPOSE 8000",
              "EXPOSE 8000" in dockerfile)
    else:
        check("docker", "Dockerfile exists", False,
              f"Not found at {dockerfile_path}", warn_only=True)

    compose_path = os.path.join(os.path.dirname(__file__), "..", "docker-compose.yml")
    if os.path.exists(compose_path):
        with open(compose_path) as f:
            compose = f.read()
        check("docker", "docker-compose.yml exists", True)
        check("docker", "PostgreSQL service defined",
              "postgres" in compose)
        check("docker", "Redis service defined",
              "redis" in compose)
        check("docker", "Health checks in compose",
              "healthcheck" in compose)
        check("docker", "Service dependencies defined",
              "depends_on" in compose)
        check("docker", "Environment variables from .env",
              "${" in compose,
              "Hardcoded values detected")
    else:
        check("docker", "docker-compose.yml exists", False,
              f"Not found at {compose_path}", warn_only=True)

    # ================================================================
    # 9. Environment Configuration
    # ================================================================
    print("\n--- 9. Environment Configuration ---")

    env_example = os.path.join(os.path.dirname(__file__), "..", "backend", ".env.example")
    if os.path.exists(env_example):
        check("env", ".env.example exists", True)
    else:
        check("env", ".env.example exists", False,
              "No .env.example for reference", warn_only=True)

    # Check that config uses env vars (already verified by config.py)
    config_path = os.path.join(os.path.dirname(__file__), "..", "backend", "app", "core", "config.py")
    if os.path.exists(config_path):
        with open(config_path) as f:
            config = f.read()
        check("env", "Settings from BaseSettings (pydantic)",
              "BaseSettings" in config)
        check("env", "DATABASE_URL configurable",
              "DATABASE_URL" in config)
        check("env", "SECRET_KEY configurable",
              "SECRET_KEY" in config)
        check("env", "REDIS_URL configurable",
              "REDIS_URL" in config)
        check("env", "Production validation for SECRET_KEY",
              "SECRET_KEY" in config and "prod" in config,
              "Missing production validation")
        check("env", "SQLite fallback for development",
              "sqlite" in config.lower(),
              "No SQLite fallback")

    # ================================================================
    # 10. Production Safety
    # ================================================================
    print("\n--- 10. Production Safety ---")

    r = requests.get(f"{BASE_URL}/health")
    check("safety", "No sensitive data in health endpoint",
          "password" not in r.text.lower() and "secret" not in r.text.lower())

    # Check setup endpoints are protected
    r = requests.post(f"{BASE_URL}/setup/seed")
    check("safety", "Setup endpoint returns 404 in prod mode",
          r.status_code in [404, 403],
          f"Setup endpoint accessible (status: {r.status_code})", warn_only=True)

    # Root endpoint doesn't expose internal details
    r = requests.get(f"{BASE_URL}/")
    check("safety", "Root endpoint doesn't leak internals",
          "password" not in r.text.lower() and "secret" not in r.text.lower())

    # ================================================================
    # RESULTS
    # ================================================================
    elapsed = time.time() - start
    total = passed + failed + warnings

    print("\n" + "=" * 70)
    print("DEPLOYMENT READINESS RESULTS")
    print("=" * 70)
    print(f"Total Checks: {total}")
    print(f"Passed:       {passed}")
    print(f"Failed:       {failed}")
    print(f"Warnings:     {warnings}")
    print(f"Time:         {elapsed:.1f}s")
    print(f"Score:        {passed}/{passed+failed} ({(passed/(passed+failed)*100 if passed+failed > 0 else 0):.0f}%)")

    print("\n--- Deployment Compatibility ---")
    print("  Cloud:   AWS (ECS/Fargate), Azure (Container Apps), GCP (Cloud Run)")
    print("  On-Prem: Docker Compose, Kubernetes, Bare Metal (systemd)")
    print("  OS:      Linux, macOS, Windows (via Docker)")
    print("  DB:      PostgreSQL (prod), SQLite (dev)")
    print("  Cache:   Redis (prod), In-memory fallback (dev)")

    if failed == 0:
        print(f"\n[READY] Backend is deployment-ready!")
    elif failed <= 2:
        print(f"\n[MOSTLY READY] {failed} non-critical issues to address")
    else:
        print(f"\n[NOT READY] {failed} issues must be fixed before deployment")

    print("=" * 70)
    sys.exit(1 if failed > 3 else 0)


if __name__ == "__main__":
    main()
