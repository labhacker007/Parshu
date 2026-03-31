@echo off
REM ==================================================================
REM  AUTOHEAL - Automatically detect and fix common Jyoti issues
REM  Run this when something doesn't work. It checks everything.
REM ==================================================================

cd /d "%~dp0"

echo.
echo ==============================================================
echo  JYOTI AUTOHEAL - Diagnosing and fixing issues...
echo ==============================================================
echo.

set ISSUES_FOUND=0
set FIXES_APPLIED=0

REM ─── Check 1: Docker running? ─────────────────────────────────
echo [1/8] Checking Docker...
docker info >nul 2>&1
if errorlevel 1 (
    echo   FAIL: Docker is not running!
    echo   FIX:  Start Docker Desktop and run this again.
    set /a ISSUES_FOUND+=1
    goto :summary
) else (
    echo   OK: Docker is running
)

REM ─── Check 2: Containers exist? ───────────────────────────────
echo [2/8] Checking containers...
docker ps -a --format "{{.Names}}" | findstr "parshu-backend-1" >nul 2>&1
if errorlevel 1 (
    echo   WARN: Backend container not found. Creating...
    docker-compose up -d
    timeout /t 20 /nobreak >nul
    set /a FIXES_APPLIED+=1
) else (
    echo   OK: Containers exist
)

REM ─── Check 3: Containers running? ─────────────────────────────
echo [3/8] Checking container status...
docker ps --format "{{.Names}} {{.Status}}" | findstr "parshu-backend-1" | findstr "Up" >nul 2>&1
if errorlevel 1 (
    echo   WARN: Backend is not running. Starting...
    docker-compose up -d
    timeout /t 15 /nobreak >nul
    set /a FIXES_APPLIED+=1
    set /a ISSUES_FOUND+=1
) else (
    echo   OK: Backend is running
)

docker ps --format "{{.Names}} {{.Status}}" | findstr "parshu-frontend-1" | findstr "Up" >nul 2>&1
if errorlevel 1 (
    echo   WARN: Frontend is not running. Starting...
    docker-compose up -d
    timeout /t 15 /nobreak >nul
    set /a FIXES_APPLIED+=1
    set /a ISSUES_FOUND+=1
) else (
    echo   OK: Frontend is running
)

REM ─── Check 4: Backend responding? ─────────────────────────────
echo [4/8] Checking backend health...
curl -sf http://localhost:8000/health >nul 2>&1
if errorlevel 1 (
    echo   WARN: Backend not responding. Restarting...
    docker restart parshu-backend-1
    timeout /t 15 /nobreak >nul
    set /a FIXES_APPLIED+=1
    set /a ISSUES_FOUND+=1

    REM Recheck after restart
    curl -sf http://localhost:8000/health >nul 2>&1
    if errorlevel 1 (
        echo   FAIL: Backend still not responding after restart.
        echo   FIX:  Run REBUILD.bat backend
    ) else (
        echo   OK: Backend recovered after restart
    )
) else (
    echo   OK: Backend is healthy
)

REM ─── Check 5: Frontend responding? ─────────────────────────────
echo [5/8] Checking frontend...
curl -sf http://localhost:3000 >nul 2>&1
if errorlevel 1 (
    echo   WARN: Frontend not responding. Restarting...
    docker restart parshu-frontend-1
    timeout /t 15 /nobreak >nul
    set /a FIXES_APPLIED+=1
    set /a ISSUES_FOUND+=1

    curl -sf http://localhost:3000 >nul 2>&1
    if errorlevel 1 (
        echo   FAIL: Frontend still not responding.
        echo   FIX:  Run REBUILD.bat frontend
    ) else (
        echo   OK: Frontend recovered after restart
    )
) else (
    echo   OK: Frontend is responding
)

REM ─── Check 6: Database has data? ──────────────────────────────
echo [6/8] Checking database...
for /f "delims=" %%i in ('curl -sf http://localhost:8000/health 2^>nul') do set HEALTH_DATA=%%i
echo %HEALTH_DATA% | findstr "\"users\": 0" >nul 2>&1
if not errorlevel 1 (
    echo   WARN: Database is empty. Seeding...
    curl -sf -X POST http://localhost:8000/setup/seed >nul 2>&1
    set /a FIXES_APPLIED+=1
    set /a ISSUES_FOUND+=1
    echo   OK: Database seeded
) else (
    echo   OK: Database has data
)

REM ─── Check 7: Articles exist? ──────────────────────────────────
echo [7/8] Checking articles...
echo %HEALTH_DATA% | findstr "\"articles\": 0" >nul 2>&1
if not errorlevel 1 (
    echo   WARN: No articles found. Ingesting...
    curl -sf -X POST http://localhost:8000/setup/ingest >nul 2>&1
    set /a FIXES_APPLIED+=1
    set /a ISSUES_FOUND+=1
    echo   OK: Articles ingested
) else (
    echo   OK: Articles exist
)

REM ─── Check 8: Git status ──────────────────────────────────────
echo [8/8] Checking git...
for /f %%b in ('git branch --show-current 2^>nul') do set GIT_BRANCH=%%b
echo   Branch: %GIT_BRANCH%
git diff --stat --cached 2>nul | findstr "." >nul 2>&1
if not errorlevel 1 (
    echo   NOTE: You have staged changes. Consider committing.
)

:summary
echo.
echo ==============================================================
if %ISSUES_FOUND%==0 (
    echo  All checks passed! Jyoti is healthy.
) else (
    echo  Issues found: %ISSUES_FOUND%  ^|  Auto-fixes applied: %FIXES_APPLIED%
)
echo ==============================================================
echo.
echo  Frontend:  http://localhost:3000
echo  Backend:   http://localhost:8000
echo  API Docs:  http://localhost:8000/docs
echo.
pause
