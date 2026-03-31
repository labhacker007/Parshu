#!/usr/bin/env python3
"""Quick debug test for Day 5 guardrails API."""
import requests
import json

BASE_URL = "http://localhost:8000"
ADMIN_EMAIL = "admin@huntsphere.local"
ADMIN_PASSWORD = "Admin123!@2026"

# Login
print("Logging in...")
login_resp = requests.post(f"{BASE_URL}/auth/login", json={
    "email": ADMIN_EMAIL,
    "password": ADMIN_PASSWORD
})

print(f"Login status: {login_resp.status_code}")

if login_resp.status_code != 200:
    print("Login failed!")
    print(login_resp.text)
    exit(1)

token = login_resp.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}

# Test list guardrails
print("\nTesting GET /admin/guardrails/...")
resp = requests.get(f"{BASE_URL}/admin/guardrails/", headers=headers)
print(f"Status: {resp.status_code}")
if resp.status_code != 200:
    print(f"Error: {resp.text}")
    exit(1)
else:
    print(f"Response: {json.dumps(resp.json(), indent=2)}")

# Test list guardrail types
print("\nTesting GET /admin/guardrails/types...")
resp = requests.get(f"{BASE_URL}/admin/guardrails/types", headers=headers)
print(f"Status: {resp.status_code}")
if resp.status_code != 200:
    print(f"Error: {resp.text}")
    exit(1)
else:
    print(f"Response ({len(resp.json())} types)")
    for t in resp.json()[:3]:
        print(f"  - {t['type']}: {t['description']}")

print("\n✓ Basic guardrails endpoints working!")
