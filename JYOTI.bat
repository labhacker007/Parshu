@echo off
REM ==================================================================
REM  JYOTI - Main development helper
REM  Usage: JYOTI.bat [command]
REM  Commands: status, health, test, logs, urls, seed, ingest, clean
REM ==================================================================

cd /d "%~dp0"

if "%1"=="" goto :help
if "%1"=="status" goto :status
if "%1"=="health" goto :health
if "%1"=="test" goto :test
if "%1"=="logs" goto :logs
if "%1"=="urls" goto :urls
if "%1"=="seed" goto :seed
if "%1"=="ingest" goto :ingest
if "%1"=="clean" goto :clean
if "%1"=="backend-test" goto :backend_test
if "%1"=="api-check" goto :api_check
if "%1"=="help" goto :help
goto :help

:status
echo.
echo === JYOTI STATUS ===
echo.
echo [Docker Containers]
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>nul || echo   Docker not running!
echo.
echo [Git Branch]
git branch --show-current
echo.
echo [Last Commit]
git log --oneline -1
echo.
echo [Uncommitted Changes]
git status --short
echo.
goto :end

:health
echo.
echo === HEALTH CHECK ===
echo.
echo [Backend /health]
curl -s http://localhost:8000/health 2>nul || echo   Backend NOT responding!
echo.
echo.
echo [Backend /metrics]
curl -s http://localhost:8000/metrics 2>nul | findstr "jyoti_up" || echo   Metrics NOT available!
echo.
echo [Frontend]
curl -s -o nul -w "  HTTP Status: %%{http_code}" http://localhost:3000 2>nul || echo   Frontend NOT responding!
echo.
goto :end

:test
echo.
echo === RUNNING BACKEND TESTS ===
echo.
if exist "scripts\verify_deployment.py" (
    docker exec parshu-backend-1 python -m pytest /app/tests/ -v --tb=short 2>nul || echo   Tests not available in container. Run locally:
    echo   cd backend ^&^& python -m pytest tests/ -v
) else (
    echo   No test scripts found.
)
echo.
goto :end

:backend_test
echo.
echo === BACKEND API SMOKE TEST ===
echo.
echo [1] Health endpoint...
curl -sf http://localhost:8000/health >nul 2>&1 && echo   PASS: /health || echo   FAIL: /health
echo [2] Root endpoint...
curl -sf http://localhost:8000/ >nul 2>&1 && echo   PASS: / || echo   FAIL: /
echo [3] Metrics endpoint...
curl -sf http://localhost:8000/metrics >nul 2>&1 && echo   PASS: /metrics || echo   FAIL: /metrics
echo [4] Docs endpoint...
curl -sf http://localhost:8000/docs >nul 2>&1 && echo   PASS: /docs || echo   FAIL: /docs
echo [5] Login endpoint (expects 422)...
curl -sf -o nul -w "%%{http_code}" -X POST http://localhost:8000/auth/login -H "Content-Type: application/json" -d "{}" 2>nul | findstr "422" >nul && echo   PASS: /auth/login (422 expected) || echo   FAIL: /auth/login
echo [6] Sources endpoint (expects 401)...
curl -sf -o nul -w "%%{http_code}" http://localhost:8000/sources/ 2>nul | findstr "401" >nul && echo   PASS: /sources/ (401 expected) || echo   FAIL: /sources/
echo [7] Articles endpoint (expects 401)...
curl -sf -o nul -w "%%{http_code}" http://localhost:8000/articles/triage 2>nul | findstr "401" >nul && echo   PASS: /articles/triage (401 expected) || echo   FAIL: /articles/triage
echo.
goto :end

:api_check
echo.
echo === API ROUTE CHECK ===
echo.
echo Fetching OpenAPI schema...
curl -s http://localhost:8000/openapi.json 2>nul | python -c "import sys,json; d=json.load(sys.stdin); paths=sorted(d.get('paths',{}).keys()); print(f'Total endpoints: {len(paths)}'); [print(f'  {p}') for p in paths]" 2>nul || echo   Could not fetch OpenAPI schema. Is backend running?
echo.
goto :end

:logs
echo.
if "%2"=="backend" (
    echo === BACKEND LOGS (last 50 lines) ===
    docker logs --tail 50 parshu-backend-1 2>&1
) else if "%2"=="frontend" (
    echo === FRONTEND LOGS (last 50 lines) ===
    docker logs --tail 50 parshu-frontend-1 2>&1
) else (
    echo === BACKEND LOGS (last 30 lines) ===
    docker logs --tail 30 parshu-backend-1 2>&1
    echo.
    echo === FRONTEND LOGS (last 20 lines) ===
    docker logs --tail 20 parshu-frontend-1 2>&1
)
echo.
goto :end

:urls
echo.
echo === JYOTI URLs ===
echo.
echo   Frontend:    http://localhost:3000
echo   Backend:     http://localhost:8000
echo   API Docs:    http://localhost:8000/docs
echo   ReDoc:       http://localhost:8000/redoc
echo   Health:      http://localhost:8000/health
echo   Metrics:     http://localhost:8000/metrics
echo   OpenAPI:     http://localhost:8000/openapi.json
echo.
goto :end

:seed
echo.
echo === SEEDING DATABASE ===
echo.
curl -s -X POST http://localhost:8000/setup/seed 2>nul || echo   Seed failed. Is backend running?
echo.
goto :end

:ingest
echo.
echo === INGESTING ARTICLES ===
echo.
curl -s -X POST http://localhost:8000/setup/ingest 2>nul || echo   Ingest failed. Is backend running?
echo.
goto :end

:clean
echo.
echo === CLEANING UP ===
echo.
echo [1] Removing __pycache__...
for /d /r "backend" %%d in (__pycache__) do @if exist "%%d" rd /s /q "%%d" 2>nul
echo [2] Removing .pyc files...
del /s /q "backend\*.pyc" 2>nul
echo [3] Removing node_modules cache...
if exist "frontend\.cache" rd /s /q "frontend\.cache" 2>nul
echo Done!
echo.
goto :end

:help
echo.
echo ================================================================
echo  JYOTI - Development Helper
echo ================================================================
echo.
echo  Usage: JYOTI.bat [command]
echo.
echo  Commands:
echo    status       - Show containers, git branch, uncommitted changes
echo    health       - Check backend/frontend health
echo    test         - Run backend tests
echo    backend-test - Smoke test all major API endpoints
echo    api-check    - List all API routes from OpenAPI schema
echo    logs         - Show recent logs (add: backend or frontend)
echo    urls         - Show all service URLs
echo    seed         - Seed the database with initial data
echo    ingest       - Ingest articles from feed sources
echo    clean        - Clean up cache/temp files
echo    help         - Show this help
echo.
echo  Quick Commands:
echo    REBUILD.bat [backend^|frontend]  - Rebuild containers
echo    RESTART.bat [backend^|frontend]  - Restart containers
echo    AUTOHEAL.bat                    - Auto-fix common issues
echo.
goto :end

:end
