import os

import pytest
from fastapi.testclient import TestClient

from app.core.fetch import FetchResult
from app.core.database import SessionLocal
from app.models import Article, ExtractedIntelligence, ExtractedIntelligenceType


def login_admin(client: TestClient) -> str:
    r = client.post(
        "/auth/login",
        json={
            "email": os.environ["ADMIN_EMAIL"],
            "password": os.environ["ADMIN_PASSWORD"]
        }
    )
    assert r.status_code == 200
    return r.json()["access_token"]


@pytest.fixture(autouse=True)
def stub_external_calls(monkeypatch):
    html = "<html><head><title>Threat Doc</title></head><body><p>IOC 1.2.3.4</p></body></html>"
    fetch_result = FetchResult(
        url="https://example.com/threat-report",
        final_url="https://example.com/threat-report",
        status_code=200,
        headers={"content-type": "text/html"},
        text=html,
        content=html.encode("utf-8")
    )

    monkeypatch.setattr(
        "app.integrations.sources.safe_fetch_text_sync",
        lambda *args, **kwargs: fetch_result
    )

    async def fake_document_extract(*args, **kwargs):
        return "Detailed threat context with IOC 1.2.3.4 and MITRE T1059"

    monkeypatch.setattr(
        "app.integrations.sources.DocumentProcessor.extract",
        fake_document_extract
    )

    async def fake_genai_extract(text, source_url=None, db_session=None):
        return {
            "iocs": [{"value": "1.2.3.4"}],
            "ttps": [{"mitre_id": "T1059", "name": "Command and Scripting Interpreter"}],
            "atlas": []
        }

    monkeypatch.setattr(
        "app.integrations.sources.IntelligenceExtractor.extract_with_genai",
        fake_genai_extract
    )

    class DummyModelManager:
        async def generate_with_fallback(self, system_prompt, user_prompt, **kwargs):
            if "executive" in system_prompt.lower():
                return {"response": "Executive summary text", "model_used": "dummy"}
            return {"response": "Technical summary text", "model_used": "dummy"}

    monkeypatch.setattr(
        "app.integrations.sources.get_model_manager",
        lambda: DummyModelManager()
    )

    yield


def test_custom_feed_ingest_creates_article(client: TestClient):
    token = login_admin(client)
    response = client.post(
        "/sources/custom/ingest",
        json={"url": "https://example.com/threat-report", "title": "Threat Doc", "feed_name": "custom-pdfs"},
        headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "success"
    assert payload["executive_summary"] == "Executive summary text"
    assert payload["technical_summary"] == "Technical summary text"

    db = SessionLocal()
    try:
        article = db.query(Article).filter(Article.title == "Threat Doc").first()
        assert article is not None
        assert article.executive_summary == "Executive summary text"
        assert article.technical_summary == "Technical summary text"

        ioc_count = db.query(ExtractedIntelligence).filter(
            ExtractedIntelligence.article_id == article.id,
            ExtractedIntelligence.intelligence_type == ExtractedIntelligenceType.IOC
        ).count()
        ttp_count = db.query(ExtractedIntelligence).filter(
            ExtractedIntelligence.article_id == article.id,
            ExtractedIntelligence.intelligence_type == ExtractedIntelligenceType.TTP
        ).count()

        assert ioc_count == 1
        assert ttp_count == 1
    finally:
        db.close()
