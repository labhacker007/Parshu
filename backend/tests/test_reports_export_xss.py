import os

from app.core.database import SessionLocal
from app.models import Article, FeedSource


def login_admin(client):
    r = client.post("/auth/login", json={"email": os.environ["ADMIN_EMAIL"], "password": os.environ["ADMIN_PASSWORD"]})
    assert r.status_code == 200
    return r.json()["access_token"]


def _create_article(db):
    source = db.query(FeedSource).first()
    if not source:
        source = FeedSource(name="test-source", url="http://example.com/source", is_active=True)
        db.add(source)
        db.commit()
        db.refresh(source)

    article = Article(
        source_id=source.id,
        external_id="test-export-xss-article-1",
        title="Test Article For HTML Export",
        url="http://example.com/article",
        raw_content="raw",
        normalized_content="normalized",
        status="NEW",
    )
    db.add(article)
    db.commit()
    db.refresh(article)
    return article


def test_reports_export_html_escapes_user_content(client):
    admin_token = login_admin(client)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    db = SessionLocal()
    try:
        article = _create_article(db)
    finally:
        db.close()

    r_create = client.post(
        "/reports/",
        json={"title": "Safe Report", "article_ids": [article.id], "report_type": "executive", "use_genai": False},
        headers=admin_headers,
    )
    assert r_create.status_code == 200
    report_id = r_create.json()["id"]

    malicious_title = "<script>alert(1)</script>"
    malicious_content = "\n".join(
        [
            "# Executive Summary",
            "Click [bad](javascript:alert(1)) and [inject](http://example.com\" onmouseover=\"alert(1)).",
            "Normal **bold** and `code` should still render.",
        ]
    )

    r_patch = client.patch(
        f"/reports/{report_id}",
        json={"title": malicious_title, "content": malicious_content},
        headers=admin_headers,
    )
    assert r_patch.status_code == 200

    r_export = client.get(f"/reports/{report_id}/export/html", headers=admin_headers)
    assert r_export.status_code == 200
    body = r_export.text

    # Title is escaped, scripts do not execute
    assert "<script>" not in body
    assert "&lt;script&gt;alert(1)&lt;/script&gt;" in body

    # Links are sanitized; javascript: URLs are blocked
    assert "href=\"javascript:" not in body
    assert "javascript:" not in body
    assert "href=\"#\"" in body

    # Attribute injection via quotes/spaces is rejected by the href sanitizer
    assert "onmouseover" not in body

    # Security headers on external links
    assert "rel=\"noopener noreferrer\"" in body

