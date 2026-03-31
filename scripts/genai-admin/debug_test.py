#!/usr/bin/env python3
"""Quick debug test to see 500 errors."""
import requests

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
print(f"Login response: {login_resp.text}")

if login_resp.status_code != 200:
    print("Login failed!")
    exit(1)

token = login_resp.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}

# Create function
print("\nCreating function...")
create_resp = requests.post(f"{BASE_URL}/admin/genai/functions/",
    headers=headers,
    json={
        "function_name": "debug_test",
        "display_name": "Debug Test",
        "description": "Testing",
        "primary_model_id": "gpt-4o-mini"
    }
)
print(f"Create status: {create_resp.status_code}")
if create_resp.status_code not in [200, 201, 409]:
    print(f"Create failed: {create_resp.text}")
    exit(1)

# Get function
print("\nGetting function...")
get_resp = requests.get(f"{BASE_URL}/admin/genai/functions/debug_test", headers=headers)
print(f"Get status: {get_resp.status_code}")
print(f"Get response: {get_resp.text}")

# Get stats
print("\nGetting stats...")
stats_resp = requests.get(f"{BASE_URL}/admin/genai/functions/debug_test/stats?days=30", headers=headers)
print(f"Stats status: {stats_resp.status_code}")
print(f"Stats response: {stats_resp.text}")

# Cleanup
print("\nCleaning up...")
delete_resp = requests.delete(f"{BASE_URL}/admin/genai/functions/debug_test", headers=headers)
print(f"Delete status: {delete_resp.status_code}")
