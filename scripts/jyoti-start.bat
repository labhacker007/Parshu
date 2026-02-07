@echo off
REM Jyoti - Automated Startup Script for Windows
REM This script handles common Docker issues automatically

setlocal enabledelayedexpansion

echo ╔════════════════════════════════════════════════════════════╗
echo ║           Jyoti News Aggregator - Auto Startup            ║
echo ╚════════════════════════════════════════════════════════════╝
echo.

cd /d "%~dp0\.."

REM Check if Docker is running
echo [INFO] Checking Docker status...
docker info >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker is not running. Please start Docker Desktop.
    pause
    exit /b 1
)
echo [OK] Docker is running
echo.

REM Stop existing containers
echo [INFO] Stopping existing containers...
docker-compose down >nul 2>&1
echo [OK] Containers stopped
echo.

REM Start containers
echo [INFO] Starting containers...
docker-compose up -d
if errorlevel 1 (
    echo [ERROR] Failed to start containers
    pause
    exit /b 1
)
echo [OK] Containers started
echo.

REM Wait for containers to be healthy
echo [INFO] Waiting for containers to become healthy (max 120s)...
set /a TIMEOUT=120
set /a ELAPSED=0
set /a INTERVAL=5

:wait_loop
if !ELAPSED! GEQ !TIMEOUT! goto timeout_reached

REM Check container status
for /f "tokens=*" %%i in ('docker inspect parshu-backend-1 --format^=^"^{^{.State.Health.Status^}^}^" 2^>nul') do set BACKEND_HEALTH=%%i
for /f "tokens=*" %%i in ('docker inspect parshu-frontend-1 --format^=^"^{^{.State.Health.Status^}^}^" 2^>nul') do set FRONTEND_HEALTH=%%i
for /f "tokens=*" %%i in ('docker inspect parshu-postgres-1 --format^=^"^{^{.State.Health.Status^}^}^" 2^>nul') do set POSTGRES_HEALTH=%%i
for /f "tokens=*" %%i in ('docker inspect parshu-redis-1 --format^=^"^{^{.State.Health.Status^}^}^" 2^>nul') do set REDIS_HEALTH=%%i

echo   Backend: !BACKEND_HEALTH! ^| Frontend: !FRONTEND_HEALTH! ^| PostgreSQL: !POSTGRES_HEALTH! ^| Redis: !REDIS_HEALTH!

if "!BACKEND_HEALTH!"=="healthy" if "!FRONTEND_HEALTH!"=="healthy" if "!POSTGRES_HEALTH!"=="healthy" if "!REDIS_HEALTH!"=="healthy" (
    echo [OK] All containers are healthy!
    goto containers_ready
)

timeout /t !INTERVAL! /nobreak >nul
set /a ELAPSED=!ELAPSED!+!INTERVAL!
goto wait_loop

:timeout_reached
echo [ERROR] Containers did not become healthy within %TIMEOUT%s
echo [WARNING] Attempting backend restart...
docker restart parshu-backend-1
timeout /t 10 /nobreak >nul
goto health_checks

:containers_ready
echo.

:health_checks
REM Check backend API
echo [INFO] Running application health checks...
curl -s -m 5 http://localhost:8000/health >health_check.tmp 2>nul
findstr /C:"healthy" health_check.tmp >nul
if errorlevel 1 (
    echo [WARNING] Backend API not responding, restarting...
    docker restart parshu-backend-1
    timeout /t 10 /nobreak >nul
    curl -s -m 5 http://localhost:8000/health >health_check.tmp 2>nul
    findstr /C:"healthy" health_check.tmp >nul
    if errorlevel 1 (
        echo [ERROR] Backend still not responding. Check logs: docker logs parshu-backend-1
        del health_check.tmp 2>nul
        pause
        exit /b 1
    )
)
echo [OK] Backend API is responding
del health_check.tmp 2>nul

REM Check frontend
curl -s -m 5 http://localhost:3000/ >frontend_check.tmp 2>nul
findstr /C:"root" frontend_check.tmp >nul
if errorlevel 1 (
    echo [ERROR] Frontend is not responding correctly
    del frontend_check.tmp 2>nul
    pause
    exit /b 1
)
echo [OK] Frontend is serving pages
del frontend_check.tmp 2>nul
echo.

REM Get admin credentials
set ADMIN_EMAIL=admin@huntsphere.local
set ADMIN_PASSWORD=Admin123!@2026
if exist .env (
    for /f "tokens=1,2 delims==" %%a in ('findstr "ADMIN_EMAIL" .env') do set ADMIN_EMAIL=%%b
    for /f "tokens=1,2 delims==" %%a in ('findstr "ADMIN_PASSWORD" .env') do set ADMIN_PASSWORD=%%b
)

echo ╔════════════════════════════════════════════════════════════╗
echo ║                  ✓ JYOTI IS READY!                        ║
echo ╚════════════════════════════════════════════════════════════╝
echo.
echo 📍 Access URLs:
echo    Frontend:  http://localhost:3000
echo    Backend:   http://localhost:8000
echo    API Docs:  http://localhost:8000/docs
echo.
echo 🔐 Admin Credentials:
echo    Email:    !ADMIN_EMAIL!
echo    Password: !ADMIN_PASSWORD!
echo.
echo 📊 Container Status:
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | findstr "parshu-"
echo.
echo 💡 Useful Commands:
echo    View logs:        docker-compose logs -f
echo    Restart backend:  docker restart parshu-backend-1
echo    Stop all:         docker-compose down
echo    Rebuild:          docker-compose build --no-cache
echo.
echo Press any key to continue (containers will keep running in background)...
pause >nul
