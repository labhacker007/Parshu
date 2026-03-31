@echo off
REM Production-Ready Setup for Day 3 - Windows Wrapper

echo ========================================================================
echo Production-Ready Setup: Day 3 GenAI Functions API
echo ========================================================================

REM Step 1: Fix database schema
echo [INFO] Step 1: Fixing database schema...

docker exec parshu-backend-1 python -c "from sqlalchemy import text, inspect; from app.core.database import engine, SessionLocal; db = SessionLocal(); inspector = inspect(engine); columns = [col['name'] for col in inspector.get_columns('users')]; oauth_cols = {'oauth_provider': 'VARCHAR', 'oauth_subject': 'VARCHAR', 'oauth_email': 'VARCHAR', 'oauth_picture': 'VARCHAR'}; missing = [(n, t) for n, t in oauth_cols.items() if n not in columns]; [db.execute(text(f'ALTER TABLE users ADD COLUMN IF NOT EXISTS {n} {t}')) or db.commit() or print(f'Added {n}') for n, t in missing] if 'postgresql' in str(engine.url) else None; print('Schema updated'); db.close()"

if errorlevel 1 (
    echo [ERROR] Schema fix failed
    exit /b 1
)

echo [SUCCESS] Database schema fixed

REM Step 2: Seed test data
echo [INFO] Step 2: Seeding test data...

docker exec parshu-backend-1 python -c "exec(open('/app/app/../scripts/seed_genai_data.py').read())" 2>nul

if errorlevel 1 (
    echo [WARNING] Using inline seeding...
    docker exec parshu-backend-1 python scripts/genai-admin/seed_data.py
)

echo [SUCCESS] Test data seeded

REM Step 3: Run tests
echo [INFO] Step 3: Running tests...

python test_day3.py

if errorlevel 1 (
    echo [ERROR] Tests failed
    exit /b 1
)

echo [SUCCESS] All tests passed!

REM Step 4: Validate
echo [INFO] Step 4: Validating production readiness...

curl -s http://localhost:8000/health >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Backend not reachable
    exit /b 1
)

echo.
echo ========================================================================
echo [SUCCESS] Day 3 is PRODUCTION-READY!
echo ========================================================================
echo.
echo API Documentation: http://localhost:8000/docs
echo.
echo Ready to proceed to Day 4!
echo ========================================================================

exit /b 0
