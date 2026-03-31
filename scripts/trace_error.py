#!/usr/bin/env python3
"""Trace the exact error on /admin/guardrails/types."""
import requests
import traceback

BASE = "http://localhost:8000"

# Login
r = requests.post(f"{BASE}/auth/login", json={
    "email": "admin@huntsphere.local",
    "password": "Admin123!@2026"
})
token = r.json()["access_token"]
h = {"Authorization": f"Bearer {token}"}

# Try to reproduce the import error directly
print("Testing direct import of DEFAULT_GUARDRAILS...")
try:
    from app.genai.prompts import DEFAULT_GUARDRAILS
    print(f"  SUCCESS: Found DEFAULT_GUARDRAILS with {len(DEFAULT_GUARDRAILS)} entries")
except ImportError as e:
    print(f"  IMPORT ERROR: {e}")

# Now test the endpoint
print("\nTesting /admin/guardrails/types endpoint...")
r2 = requests.get(f"{BASE}/admin/guardrails/types", headers=h)
print(f"  Status: {r2.status_code}")
print(f"  Body: {r2.text[:200]}")

# Try calling the function directly
print("\nTesting list_guardrail_types directly...")
try:
    from app.admin.guardrails import GUARDRAIL_TYPES, GuardrailTypeInfo
    types = [
        GuardrailTypeInfo(
            type=gtype,
            description=info["description"],
            example_config=info["example_config"]
        )
        for gtype, info in GUARDRAIL_TYPES.items()
    ]
    print(f"  SUCCESS: {len(types)} guardrail types")
    for t in types:
        print(f"    - {t.type}: {t.description}")
except Exception as e:
    print(f"  ERROR: {e}")
    traceback.print_exc()
