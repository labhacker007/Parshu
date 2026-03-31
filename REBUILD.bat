@echo off
REM ==================================================================
REM  REBUILD - Quick rebuild and restart for development
REM  Use this when you make code changes to backend or frontend
REM ==================================================================

echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║          REBUILD - Development Quick Restart              ║
echo ╚════════════════════════════════════════════════════════════╝
echo.

cd /d "%~dp0"

REM Check what needs rebuilding
set REBUILD_BACKEND=0
set REBUILD_FRONTEND=0

if "%1"=="backend" set REBUILD_BACKEND=1
if "%1"=="frontend" set REBUILD_FRONTEND=1
if "%1"=="all" (
    set REBUILD_BACKEND=1
    set REBUILD_FRONTEND=1
)
if "%1"=="" (
    set REBUILD_BACKEND=1
    set REBUILD_FRONTEND=1
)

echo [1/4] Stopping containers...
docker-compose down

if %REBUILD_BACKEND%==1 (
    echo [2/4] Rebuilding backend...
    docker-compose build backend
)

if %REBUILD_FRONTEND%==1 (
    echo [3/4] Rebuilding frontend (this may take 10+ minutes)...
    docker-compose build --no-cache frontend
)

echo [4/4] Starting all containers...
docker-compose up -d

echo Waiting 20 seconds for startup...
timeout /t 20 /nobreak >nul

echo Restarting backend for stability...
docker restart parshu-backend-1
timeout /t 10 /nobreak >nul

echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║                      ✓ REBUILD COMPLETE!                  ║
echo ╚════════════════════════════════════════════════════════════╝
echo.
echo 📍 URLs:
echo    Frontend:  http://localhost:3000
echo    Backend:   http://localhost:8000
echo    API Docs:  http://localhost:8000/docs
echo.
echo 💡 Usage:
echo    REBUILD.bat          - Rebuild both frontend and backend
echo    REBUILD.bat backend  - Rebuild only backend (fast)
echo    REBUILD.bat frontend - Rebuild only frontend (slow)
echo    REBUILD.bat all      - Rebuild everything
echo.
pause
