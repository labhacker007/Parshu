import sys
import os

# Ensure the app package is importable when running tests from repo root.
# The `app/` package lives under `backend/app`, so we add `backend/` to sys.path.
BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

# Test environment configuration must be set before importing app modules.
import tempfile

TEST_DB_PATH = os.path.join(tempfile.gettempdir(), "parshu_test.db")
if os.path.exists(TEST_DB_PATH):
    try:
        os.remove(TEST_DB_PATH)
    except Exception:
        pass

os.environ.setdefault("ENV", "test")
os.environ.setdefault("DEBUG", "true")
os.environ.setdefault("DATABASE_URL", f"sqlite:///{TEST_DB_PATH}")
os.environ.setdefault("SECRET_KEY", "test-secret-key-please-change-32-chars-minimum")
os.environ.setdefault("ENABLE_AUTOMATION_SCHEDULER", "false")
os.environ.setdefault("ADMIN_EMAIL", "admin@parshu.local")
os.environ.setdefault("ADMIN_PASSWORD", "Admin@123456789")
os.environ.setdefault("REDIS_URL", "")  # tests should not require redis

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="session", autouse=True)
def _init_test_db():
    from app.core.database import Base, engine
    # Ensure all model tables are registered on Base.metadata before create_all().
    import app.models  # noqa: F401
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    from app.seeds import seed_database
    seed_database()

    yield

    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def client():
    from app.main import app
    with TestClient(app) as c:
        yield c
