import csv
import io
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
        external_id="test-export-csv-injection-1",
        title="=1+1",
        url="http://example.com/article",
        raw_content="raw",
        normalized_content="normalized",
        status="NEW",
    )
    db.add(article)
    db.commit()
    db.refresh(article)
    return article


def test_reports_export_csv_blocks_formula_injection(client):
    admin_token = login_admin(client)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    db = SessionLocal()
    try:
        article = _create_article(db)
    finally:
        db.close()

    report_title = '=HYPERLINK("http://evil.example","click")'
    r_create = client.post(
        "/reports/",
        json={"title": report_title, "article_ids": [article.id], "report_type": "executive", "use_genai": False},
        headers=admin_headers,
    )
    assert r_create.status_code == 200
    report_id = r_create.json()["id"]

    r_export = client.get(f"/reports/{report_id}/export/csv", headers=admin_headers)
    assert r_export.status_code == 200

    rows = list(csv.reader(io.StringIO(r_export.text)))
    assert rows[0][0] == "Report Title"

    # First data row should be hardened against Excel formula injection.
    first = rows[1]
    assert first[0].startswith("'=")  # report title
    assert first[4].startswith("'=")  # article title

