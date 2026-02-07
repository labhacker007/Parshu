import requests
from app.core import config

BASE = "http://localhost:8000"


def login_admin():
    r = requests.post(f"{BASE}/auth/login", json={"email": "admin@huntsphere.local", "password": "Admin@123"})
    assert r.status_code == 200
    return r.json()['access_token']


def register_and_login(email: str = "user@example.com"):
    # Try to register a normal user and log in. If the user already exists, attempt login.
    uname = email.split("@")[0]
    r = requests.post(f"{BASE}/auth/register", json={"email": email, "username": uname, "password": "User@1234", "full_name": "Normal User"})
    if r.status_code not in (200, 201, 409):
        # Unexpected response
        assert False, f"Unexpected register status: {r.status_code} - {r.text}"

    # If user already exists (409), proceed to login; otherwise continue to login as well
    r2 = requests.post(f"{BASE}/auth/login", json={"email": email, "password": "User@1234"})
    assert r2.status_code == 200
    return r2.json()['access_token']


def test_crud_lifecycle_and_permissions():
    admin_token = login_admin()
    headers = {"Authorization": f"Bearer {admin_token}"}

    # Create connector
    payload = {"name": "test-connector", "connector_type": "xsiam", "config": {"api_key": "abc"}, "is_active": True}
    r = requests.post(f"{BASE}/connectors", json=payload, headers=headers)
    assert r.status_code == 201
    created = r.json()
    assert created['name'] == payload['name']
    conn_id = created['id']

    # Duplicate create should conflict
    r_dup = requests.post(f"{BASE}/connectors", json=payload, headers=headers)
    assert r_dup.status_code == 409

    # List connectors contains the created one
    r_list = requests.get(f"{BASE}/connectors", headers=headers)
    assert r_list.status_code == 200
    names = {c['name'] for c in r_list.json()}
    assert payload['name'] in names

    # Get by id
    r_get = requests.get(f"{BASE}/connectors/{conn_id}", headers=headers)
    assert r_get.status_code == 200
    assert r_get.json()['name'] == payload['name']

    # Update connector
    r_patch = requests.patch(f"{BASE}/connectors/{conn_id}", json={"is_active": False, "config": {"api_key": "def"}}, headers=headers)
    assert r_patch.status_code == 200
    updated = r_patch.json()
    assert updated['is_active'] is False
    assert updated['config']['api_key'] == 'def'

    # Delete connector
    r_del = requests.delete(f"{BASE}/connectors/{conn_id}", headers=headers)
    assert r_del.status_code == 200

    # Now get should 404
    r_get2 = requests.get(f"{BASE}/connectors/{conn_id}", headers=headers)
    assert r_get2.status_code == 404

    # Permission enforcement: normal user should not be able to create
    user_token = register_and_login("normal@example.com")
    headers_user = {"Authorization": f"Bearer {user_token}"}
    r_forbidden = requests.post(f"{BASE}/connectors", json={"name": "x", "connector_type": "wiz"}, headers=headers_user)
    assert r_forbidden.status_code in (403, 401)
