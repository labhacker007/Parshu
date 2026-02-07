import os
import time
from app.core.database import SessionLocal
from app.models import FeedSource, Article, Hunt

def login_admin(client):
    r = client.post("/auth/login", json={"email": os.environ["ADMIN_EMAIL"], "password": os.environ["ADMIN_PASSWORD"]})
    assert r.status_code == 200
    return r.json()["access_token"]


def test_hunt_execute_and_completion(monkeypatch, client):
    token = login_admin(client)
    headers = {"Authorization": f"Bearer {token}"}

    class DummyConnector:
        async def execute_query(self, query: str):
            return {"status": "completed", "platform": "xsiam", "results_count": 0, "results": []}

    monkeypatch.setattr("app.hunts.routes.get_connector", lambda platform: DummyConnector())

    # Create feed source, article, hunt directly in DB
    db = SessionLocal()
    try:
        # Reuse existing test feed source if present
        # Create a unique feed source to avoid duplicates across test runs
        import time
        ts = int(time.time() * 1000)
        fs_url = f'http://example.com/test-{ts}'
        fs = FeedSource(name=f'test-source-{ts}', url=fs_url, is_active=True)
        db.add(fs)
        db.commit()
        db.refresh(fs)

        # Use unique external_id to avoid dupes across test runs
        import time
        external_id = f"test-{int(time.time() * 1000)}"

        article = Article(
            source_id=fs.id,
            external_id=external_id,
            title='Test Article',
            normalized_content='This is a test article for hunts',
            url=f'http://example.com/{external_id}'
        )
        db.add(article)
        db.commit()
        db.refresh(article)

        hunt = Hunt(article_id=article.id, platform='xsiam', query_logic='SELECT * FROM logs')
        db.add(hunt)
        db.commit()
        db.refresh(hunt)
    finally:
        db.close()

    # Trigger execution via API
    r = client.post(f"/hunts/{hunt.id}/execute", headers=headers)
    assert r.status_code == 200

    # Poll executions until COMPLETED or timeout
    timeout = 5
    deadline = time.time() + timeout
    executions = []
    while time.time() < deadline:
        r2 = client.get(f"/hunts/{hunt.id}/executions", headers=headers)
        assert r2.status_code == 200
        executions = r2.json()
        if executions and executions[0]["status"] in ("COMPLETED", "FAILED"):
            break
        time.sleep(0.1)

    assert executions, "No executions found for hunt"
    ex = executions[0]
    assert ex["status"] == "COMPLETED"
    assert ex['results'] is not None
    status = ex['results'].get('status')
    assert status == "completed"
    assert ex["results"].get("platform") == "xsiam"
