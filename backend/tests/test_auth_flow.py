import os


def test_login_me_and_refresh(client):
    admin_email = os.environ["ADMIN_EMAIL"]
    admin_password = os.environ["ADMIN_PASSWORD"]

    r = client.post("/auth/login", json={"email": admin_email, "password": admin_password})
    assert r.status_code == 200
    data = r.json()
    assert "access_token" in data and "refresh_token" in data and "user" in data
    assert data["user"]["role"] == "ADMIN"

    access = data["access_token"]
    refresh = data["refresh_token"]

    r2 = client.get("/auth/me", headers={"Authorization": f"Bearer {access}"})
    assert r2.status_code == 200
    assert r2.json()["username"] == "admin"

    r3 = client.post("/auth/refresh", json={"refresh_token": refresh})
    assert r3.status_code == 200
    assert "access_token" in r3.json()
