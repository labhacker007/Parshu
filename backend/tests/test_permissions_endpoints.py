import os


def login_admin(client):
    r = client.post("/auth/login", json={"email": os.environ["ADMIN_EMAIL"], "password": os.environ["ADMIN_PASSWORD"]})
    assert r.status_code == 200
    return r.json()["access_token"]


def test_users_my_permissions_returns_expected_shape(client):
    token = login_admin(client)
    headers = {"Authorization": f"Bearer {token}"}

    r = client.get("/users/my-permissions", headers=headers)
    assert r.status_code == 200
    data = r.json()

    assert isinstance(data.get("accessible_pages"), list)
    assert isinstance(data.get("api_permissions"), list)
    assert isinstance(data.get("all_permissions"), list)
    assert data["api_permissions"] == data["all_permissions"]
    assert data.get("effective_role") == "ADMIN"

    page_keys = {p.get("key") for p in data["accessible_pages"]}
    assert "admin" in page_keys
    assert "reports" in page_keys


def test_admin_role_page_access_returns_page_permissions(client):
    token = login_admin(client)
    headers = {"Authorization": f"Bearer {token}"}

    r = client.get("/admin/rbac/pages/role/TI", headers=headers)
    assert r.status_code == 200
    data = r.json()

    assert data.get("role") == "TI"
    assert isinstance(data.get("pages"), list)
    assert isinstance(data.get("api_permissions"), list)

    # Page objects should include page-level permissions and granted subset
    pages = {p["page_key"]: p for p in data["pages"]}
    assert "reports" in pages
    reports = pages["reports"]
    assert isinstance(reports.get("all_permissions"), list)
    assert isinstance(reports.get("granted_permissions"), list)
    assert set(reports["granted_permissions"]).issubset(set(reports["all_permissions"]))
    assert reports.get("has_access") is True

