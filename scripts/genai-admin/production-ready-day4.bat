@echo off
REM Production-Ready Setup for Day 4 - Windows Wrapper

echo ========================================================================
echo Production-Ready Setup: Day 4 Prompts Management API
echo ========================================================================

REM Step 1: Rebuild backend with new prompts module
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
python test_day4.py

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
echo [SUCCESS] Day 4 is PRODUCTION-READY!
echo ========================================================================
echo.
echo API Documentation: http://localhost:8000/docs
echo.
echo Ready to proceed to Day 5!
echo ========================================================================

exit /b 0
