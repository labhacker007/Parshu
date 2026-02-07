import requests
from app.core import config

BASE = "http://localhost:8000"


def login_admin():
    r = requests.post(f"{BASE}/auth/login", json={"email": "admin@huntsphere.local", "password": "Admin@123"})
    assert r.status_code == 200
    return r.json()['access_token']


def test_test_endpoint_by_id():
    token = login_admin()
    headers = {"Authorization": f"Bearer {token}"}

    # Create connector with missing creds (unique name)
    import uuid
    name = f"id-test-missing-{uuid.uuid4().hex[:8]}"
    payload = {"name": name, "connector_type": "xsiam", "config": {}, "is_active": True}
    r = requests.post(f"{BASE}/connectors", json=payload, headers=headers)
    assert r.status_code == 201
    created = r.json()
    conn_id = created['id']

    # Test -> should fail due to missing creds
    r_test = requests.post(f"{BASE}/connectors/{conn_id}/test", headers=headers)
    assert r_test.status_code == 200
    data = r_test.json()
    assert data['ok'] is False
    assert 'missing' in data['message'].lower()

    # Update config to include creds
    r_patch = requests.patch(f"{BASE}/connectors/{conn_id}", json={"config": {"tenant_id": "t1", "api_key": "k1"}}, headers=headers)
    assert r_patch.status_code == 200

    # Test again -> should succeed
    r_test2 = requests.post(f"{BASE}/connectors/{conn_id}/test", headers=headers)
    assert r_test2.status_code == 200
    data2 = r_test2.json()
    assert data2['ok'] is True
    assert data2['last_test_status'] == 'success'
