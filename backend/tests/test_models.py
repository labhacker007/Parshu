import pytest
from datetime import datetime
from app.core.database import SessionLocal
from app.models import User, Article


def test_user_articles_relationship():
    db = SessionLocal()
    try:
        # Use a transaction and rollback at the end so tests don't persist data
        trans = db.begin()
        user = User(
            email="testuser+rel@example.local",
            username="testuser_rel",
            hashed_password="testhash",
            is_active=True,
            full_name="Test User"
        )
        db.add(user)
        db.flush()  # assign id

        article = Article(
            source_id=1,
            external_id=f"test-external-{datetime.utcnow().timestamp()}",
            title="Test Rel",
            url="http://example",
            created_at=datetime.utcnow(),
            status="NEW",
            assigned_analyst_id=user.id,
        )
        db.add(article)
        db.flush()

        # Refresh user and assert relationship
        db.refresh(user)
        assert len(user.articles) == 1
        assert user.articles[0].external_id == article.external_id
    finally:
        trans.rollback()
        db.close()
