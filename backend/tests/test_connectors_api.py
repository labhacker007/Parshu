import requests
from app.core import config

BASE = "http://localhost:8000"


def login_admin():
    r = requests.post(f"{BASE}/auth/login", json={"email": "admin@huntsphere.local", "password": "Admin@123"})
    assert r.status_code == 200
    return r.json()['access_token']


def test_connectors_test_endpoint(monkeypatch):
    token = login_admin()
    headers = {"Authorization": f"Bearer {token}"}

    # Unknown platform -> 404
    r_unknown = requests.post(f"{BASE}/connectors/platform/unknown/test", headers=headers)
    assert r_unknown.status_code == 404

    # Call test endpoint and assert structure and message semantics (server environment may or may not have creds)
    r = requests.post(f"{BASE}/connectors/platform/xsiam/test", headers=headers)
    assert r.status_code == 200
    data = r.json()
    assert data['platform'] == 'xsiam'
    assert isinstance(data.get('ok'), bool)
    assert 'message' in data

    # If creds present the message should indicate success; otherwise it should indicate missing credentials
    if data['ok']:
        assert 'ok' in data and data['message'].lower().startswith('connection')
    else:
        assert 'credentials' in data['message'].lower()
