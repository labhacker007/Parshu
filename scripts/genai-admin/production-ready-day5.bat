@echo off
REM Production-Ready Setup for Day 5 - Windows Wrapper

echo ========================================================================
echo Production-Ready Setup: Day 5 Guardrails Management API
echo ========================================================================

REM Step 1: Rebuild backend with new guardrails module
echo [INFO] Step 1: Rebuilding backend...

cd ..\..
docker-compose build backend
docker-compose up -d backend

echo [INFO] Waiting 20s for backend to be healthy...
timeout /t 20 /nobreak >nul

REM Step 2: Verify backend is healthy
echo [INFO] Step 2: Checking backend health...

curl -s http://localhost:8000/health >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Backend not reachable
    exit /b 1
)

echo [SUCCESS] Backend is healthy

REM Step 3: Run tests
echo [INFO] Step 3: Running comprehensive tests...

cd scripts\genai-admin
python test_day5.py

if errorlevel 1 (
    echo [ERROR] Tests failed
    exit /b 1
)

echo [SUCCESS] All tests passed!

REM Step 4: Validate
echo [INFO] Step 4: Validating production readiness...

curl -s http://localhost:8000/docs >nul 2>&1
if errorlevel 1 (
    echo [ERROR] API docs not accessible
    exit /b 1
)

echo.
echo ========================================================================
echo [SUCCESS] Day 5 is PRODUCTION-READY!
echo ========================================================================
echo.
echo API Documentation: http://localhost:8000/docs
echo.
echo Summary:
echo  - Guardrails Management API: COMPLETE
echo  - PII Detection: WORKING
echo  - Prompt Injection Detection: WORKING
echo  - Input Length Validation: WORKING
echo  - Profanity Filter: WORKING
echo  - Multi-layer validation: WORKING
echo.
echo Ready to proceed to Day 6 (Frontend UI)!
echo ========================================================================

exit /b 0
