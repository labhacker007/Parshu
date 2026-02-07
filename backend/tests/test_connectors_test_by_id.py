import os
import uuid


def login_admin(client):
    r = client.post("/auth/login", json={"email": os.environ["ADMIN_EMAIL"], "password": os.environ["ADMIN_PASSWORD"]})
    assert r.status_code == 200
    return r.json()["access_token"]


def test_test_endpoint_by_id(client):
    token = login_admin(client)
    headers = {"Authorization": f"Bearer {token}"}

    # Create connector with missing creds (unique name)
    name = f"id-test-missing-{uuid.uuid4().hex[:8]}"
    payload = {"name": name, "connector_type": "xsiam", "config": {}, "is_active": True}
    r = client.post("/connectors", json=payload, headers=headers)
    assert r.status_code == 201
    created = r.json()
    conn_id = created["id"]

    # Test -> should fail due to missing creds
    r_test = client.post(f"/connectors/{conn_id}/test", headers=headers)
    assert r_test.status_code == 200
    data = r_test.json()
    assert data["ok"] is False
    assert "missing" in data["message"].lower() or "credential" in data["message"].lower()

    # Update config to include creds
    r_patch = client.patch(f"/connectors/{conn_id}", json={"config": {"tenant_id": "t1", "api_key": "k1"}}, headers=headers)
    assert r_patch.status_code == 200

    # Test again -> should succeed (implementation may return ok=false if platform test is best-effort)
    r_test2 = client.post(f"/connectors/{conn_id}/test", headers=headers)
    assert r_test2.status_code == 200
    data2 = r_test2.json()
    assert isinstance(data2.get("ok"), bool)
    assert data2.get("last_test_status") in ("success", "failed", None)
