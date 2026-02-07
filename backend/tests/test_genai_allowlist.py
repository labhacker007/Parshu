import os
import uuid
from datetime import datetime

from app.core.database import SessionLocal
from app.models import User
from app.genai.models import (
    GenAIModelRegistry,
    GenAIModelConfig,
    GenAIUsageQuota,
    ConfigType
)


def login_admin(client):
    r = client.post("/auth/login", json={"email": os.environ["ADMIN_EMAIL"], "password": os.environ["ADMIN_PASSWORD"]})
    assert r.status_code == 200
    return r.json()["access_token"]


def _create_model_and_config(db, admin_id, allowed_use_cases=None, restricted_roles=None):
    identifier = f"test:model:{uuid.uuid4()}"

    model = GenAIModelRegistry(
        model_identifier=identifier,
        provider="test",
        model_name="test-model",
        display_name="Test GenAI Model",
        supports_streaming=False,
        supports_function_calling=False,
        supports_vision=False,
        max_context_length=4096,
        is_enabled=True,
        requires_api_key=False,
        is_local=True,
        requires_admin_approval=False,
        allowed_for_use_cases=allowed_use_cases or ["help"],
        restricted_to_roles=restricted_roles or [],
        added_by_user_id=admin_id,
        added_at=datetime.utcnow(),
        total_requests=0,
        total_cost=0.0
    )
    db.add(model)
    db.commit()

    config = GenAIModelConfig(
        config_name=f"test-genai-global-{uuid.uuid4()}",
        config_type=ConfigType.GLOBAL,
        preferred_model=identifier,
        temperature=0.5,
        max_tokens=150,
        top_p=0.9,
        frequency_penalty=0.0,
        presence_penalty=0.0,
        timeout_seconds=30,
        retry_attempts=1,
        is_active=True,
        is_default=False,
        created_by_user_id=admin_id,
        updated_by_user_id=admin_id,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db.add(config)
    db.commit()

    return model, config


def test_help_blocks_role_restricted_model(client):
    token = login_admin(client)
    headers = {"Authorization": f"Bearer {token}"}

    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.username == "admin").first()
        model, config = _create_model_and_config(db, admin.id, restricted_roles=["TI"])

        response = client.post(
            "/genai/help",
            json={"question": "What is Parshu?", "model": model.model_identifier},
            headers=headers
        )
        assert response.status_code == 403
        assert "not available for role" in response.json()["detail"]
    finally:
        if 'config' in locals():
            db.query(GenAIModelConfig).filter(GenAIModelConfig.id == config.id).delete()
        if 'model' in locals():
            db.query(GenAIModelRegistry).filter(GenAIModelRegistry.id == model.id).delete()
        db.commit()
        db.close()


def test_help_respects_user_quota(client):
    token = login_admin(client)
    headers = {"Authorization": f"Bearer {token}"}

    db = SessionLocal()
    quota = None
    try:
        admin = db.query(User).filter(User.username == "admin").first()
        model, config = _create_model_and_config(db, admin.id, allowed_use_cases=["help"])

        quota = GenAIUsageQuota(
            quota_name=f"help-quota-{uuid.uuid4()}",
            quota_type="user",
            user_id=admin.id,
            role_name="ADMIN",
            daily_request_limit=0,
            monthly_request_limit=0,
            daily_cost_limit=0.0,
            monthly_cost_limit=0.0,
            daily_token_limit=0,
            monthly_token_limit=0,
            current_daily_requests=0,
            current_monthly_requests=0,
            current_daily_cost=0.0,
            current_monthly_cost=0.0,
            current_daily_tokens=0,
            current_monthly_tokens=0,
            last_daily_reset=datetime.utcnow(),
            last_monthly_reset=datetime.utcnow(),
            is_active=True
        )
        db.add(quota)
        db.commit()

        response = client.post(
            "/genai/help",
            json={"question": "Explain Parshu."},
            headers=headers
        )
        assert response.status_code == 429
        assert "Daily request limit exceeded" in response.json()["detail"]
    finally:
        if quota:
            db.delete(quota)
        if 'config' in locals():
            db.query(GenAIModelConfig).filter(GenAIModelConfig.id == config.id).delete()
        if 'model' in locals():
            db.query(GenAIModelRegistry).filter(GenAIModelRegistry.id == model.id).delete()
        db.commit()
        db.close()
        db.delete(quota)
        db.query(GenAIModelConfig).filter(GenAIModelConfig.id == config.id).delete()
        db.query(GenAIModelRegistry).filter(GenAIModelRegistry.id == model.id).delete()
        db.commit()
        db.close()
