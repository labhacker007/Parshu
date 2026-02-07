import os

from app.core.database import SessionLocal
from app.models import Article, FeedSource


def login_admin(client):
    r = client.post("/auth/login", json={"email": os.environ["ADMIN_EMAIL"], "password": os.environ["ADMIN_PASSWORD"]})
    assert r.status_code == 200
    return r.json()["access_token"]


def register_and_login_user(client, email: str):
    uname = email.split("@")[0]
    r = client.post(
        "/auth/register",
        json={"email": email, "username": uname, "password": "User@12345678", "full_name": "Normal User"},
    )
    assert r.status_code in (200, 201, 409)
    r2 = client.post("/auth/login", json={"email": email, "password": "User@12345678"})
    assert r2.status_code == 200
    return r2.json()["access_token"]


def _create_article(db):
    source = db.query(FeedSource).first()
    if not source:
        source = FeedSource(name="test-source", url="http://example.com/source", is_active=True)
        db.add(source)
        db.commit()
        db.refresh(source)

    article = Article(
        source_id=source.id,
        external_id="test-report-article-1",
        title="Test Article For Report",
        url="http://example.com/article",
        raw_content="raw",
        normalized_content="normalized",
        status="NEW",
    )
    db.add(article)
    db.commit()
    db.refresh(article)
    return article


def test_reports_edit_publish_permissions(client):
    admin_token = login_admin(client)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    db = SessionLocal()
    try:
        article = _create_article(db)
    finally:
        db.close()

    # Create a draft report without GenAI to avoid external dependencies
    r_create = client.post(
        "/reports/",
        json={"title": "Test Report", "article_ids": [article.id], "report_type": "executive", "use_genai": False},
        headers=admin_headers,
    )
    assert r_create.status_code == 200
    report_id = r_create.json()["id"]

    user_token = register_and_login_user(client, "reportviewer@example.com")
    user_headers = {"Authorization": f"Bearer {user_token}"}

    # Non-privileged user cannot edit
    r_patch = client.patch(f"/reports/{report_id}", json={"title": "Hacked"}, headers=user_headers)
    assert r_patch.status_code == 403

    # Admin can edit
    r_patch_admin = client.patch(f"/reports/{report_id}", json={"title": "Edited"}, headers=admin_headers)
    assert r_patch_admin.status_code == 200
    assert r_patch_admin.json()["title"] == "Edited"

    # Non-privileged user cannot publish
    r_pub = client.post(f"/reports/{report_id}/publish", json={"notes": "x"}, headers=user_headers)
    assert r_pub.status_code == 403

    # Admin can publish
    r_pub_admin = client.post(f"/reports/{report_id}/publish", json={"notes": "ok"}, headers=admin_headers)
    assert r_pub_admin.status_code == 200
    assert r_pub_admin.json()["status"] == "PUBLISHED"

