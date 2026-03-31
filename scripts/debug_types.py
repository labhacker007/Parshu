#!/usr/bin/env python3
"""Debug the /types endpoint issue."""
import requests

BASE = "http://localhost:8000"
r = requests.post(f"{BASE}/auth/login", json={
    "email": "admin@huntsphere.local",
    "password": "Admin123!@2026"
})
print(f"Login: {r.status_code}")
token = r.json()["access_token"]
h = {"Authorization": f"Bearer {token}"}

# Test types
r2 = requests.get(f"{BASE}/admin/genai-guardrails/types", headers=h)
print(f"GET /types -> Status: {r2.status_code}")
print(f"Content-Type: {r2.headers.get('content-type')}")
print(f"Body: {r2.text[:500]}")

# Also test with explicit accept header
r3 = requests.get(f"{BASE}/admin/genai-guardrails/types", headers={**h, "Accept": "application/json"})
print(f"\nWith Accept header -> Status: {r3.status_code}")
print(f"Body: {r3.text[:500]}")
