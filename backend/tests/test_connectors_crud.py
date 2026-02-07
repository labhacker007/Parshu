import os
import uuid

def login_admin(client):
    r = client.post("/auth/login", json={"email": os.environ["ADMIN_EMAIL"], "password": os.environ["ADMIN_PASSWORD"]})
    assert r.status_code == 200
    return r.json()["access_token"]


def register_and_login(client, email: str = "user@example.com"):
    # Try to register a normal user and log in. If the user already exists, attempt login.
    uname = email.split("@")[0]
    r = client.post(
        "/auth/register",
        json={"email": email, "username": uname, "password": "User@12345678", "full_name": "Normal User"},
    )
    assert r.status_code in (200, 201, 409)

    # If user already exists (409), proceed to login; otherwise continue to login as well
    r2 = client.post("/auth/login", json={"email": email, "password": "User@12345678"})
    assert r2.status_code == 200
    return r2.json()["access_token"]


def test_crud_lifecycle_and_permissions(client):
    admin_token = login_admin(client)
    headers = {"Authorization": f"Bearer {admin_token}"}

    # Create connector
    payload = {
        "name": f"test-connector-{uuid.uuid4().hex[:8]}",
        "connector_type": "xsiam",
        "config": {"api_key": "abc"},
        "is_active": True,
    }
    r = client.post("/connectors", json=payload, headers=headers)
    assert r.status_code == 201
    created = r.json()
    assert created['name'] == payload['name']
    conn_id = created['id']

    # Duplicate create should conflict
    r_dup = client.post("/connectors", json=payload, headers=headers)
    assert r_dup.status_code == 409

    # List connectors contains the created one
    r_list = client.get("/connectors", headers=headers)
    assert r_list.status_code == 200
    names = {c['name'] for c in r_list.json()}
    assert payload['name'] in names

    # Get by id
    r_get = client.get(f"/connectors/{conn_id}", headers=headers)
    assert r_get.status_code == 200
    assert r_get.json()['name'] == payload['name']

    # Update connector
    r_patch = client.patch(
        f"/connectors/{conn_id}",
        json={"is_active": False, "config": {"api_key": "def"}},
        headers=headers,
    )
    assert r_patch.status_code == 200
    updated = r_patch.json()
    assert updated['is_active'] is False
    assert updated['config']['api_key'] == 'def'

    # Delete connector
    r_del = client.delete(f"/connectors/{conn_id}", headers=headers)
    assert r_del.status_code == 200

    # Now get should 404
    r_get2 = client.get(f"/connectors/{conn_id}", headers=headers)
    assert r_get2.status_code == 404

    # Permission enforcement: normal user should not be able to create
    user_token = register_and_login(client, "normal@example.com")
    headers_user = {"Authorization": f"Bearer {user_token}"}
    r_forbidden = client.post(
        "/connectors",
        json={"name": f"x-{uuid.uuid4().hex[:8]}", "connector_type": "wiz"},
        headers=headers_user,
    )
    assert r_forbidden.status_code in (403, 401)
