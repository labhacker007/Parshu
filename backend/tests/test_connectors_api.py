import os


def login_admin(client):
    r = client.post("/auth/login", json={"email": os.environ["ADMIN_EMAIL"], "password": os.environ["ADMIN_PASSWORD"]})
    assert r.status_code == 200
    return r.json()["access_token"]


def test_connectors_test_endpoint(monkeypatch, client):
    token = login_admin(client)
    headers = {"Authorization": f"Bearer {token}"}

    # Unknown platform -> 404
    r_unknown = client.post("/connectors/platform/unknown/test", headers=headers)
    assert r_unknown.status_code == 404

    # Call test endpoint and assert structure and message semantics (server environment may or may not have creds)
    r = client.post("/connectors/platform/xsiam/test", headers=headers)
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
