#!/usr/bin/env python3
"""Quick test of guardrails endpoints."""
import requests
import json

BASE = "http://localhost:8000"

# Login
r = requests.post(f"{BASE}/auth/login", json={
    "email": "admin@huntsphere.local",
    "password": "Admin123!@2026"
})
print(f"Login: {r.status_code}")
if r.status_code != 200:
    print(f"Login failed: {r.text}")
    exit(1)

token = r.json()["access_token"]
h = {"Authorization": f"Bearer {token}"}

# Test each guardrails endpoint
endpoints = [
    ("GET", "/admin/guardrails/", None),
    ("GET", "/admin/guardrails/types", None),
    ("POST", "/admin/guardrails/test", {
        "guardrail_type": "pii",
        "config": {"patterns": ["email"], "action_on_detect": "block"},
        "test_input": "Contact me at test@example.com"
    }),
    ("POST", "/admin/guardrails/", {
        "name": "Test PII Guard",
        "description": "Test",
        "type": "pii",
        "config": {"patterns": ["email"], "action_on_detect": "block"},
        "action": "reject",
        "max_retries": 0,
        "is_active": True
    }),
]

for method, path, body in endpoints:
    if method == "GET":
        r = requests.get(f"{BASE}{path}", headers=h)
    else:
        r = requests.post(f"{BASE}{path}", headers=h, json=body)

    status = "OK" if r.status_code < 400 else "FAIL"
    print(f"[{status}] {method} {path} -> {r.status_code}: {r.text[:200]}")

# Cleanup - delete created guardrail
try:
    guardrails = requests.get(f"{BASE}/admin/guardrails/", headers=h).json()
    for g in guardrails:
        if g["name"] == "Test PII Guard":
            r = requests.delete(f"{BASE}/admin/guardrails/{g['id']}", headers=h)
            print(f"[CLEANUP] DELETE /admin/guardrails/{g['id']} -> {r.status_code}")
except Exception as e:
    print(f"Cleanup error: {e}")
