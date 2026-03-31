@echo off
REM Smart script: Wait for Docker, then run Day 3 production setup
REM Acts as lazy engineer - handles the waiting and checking automatically

echo ========================================================================
echo Docker Health Check + Auto-Run Production Setup
echo ========================================================================
echo.

:CHECK_DOCKER
echo [INFO] Checking if Docker Desktop is running...

docker ps >nul 2>&1
if errorlevel 1 (
    echo [WARNING] Docker Desktop is not running yet
    echo.
    echo Please start Docker Desktop, then this script will auto-continue...
    echo (Checking every 10 seconds...)
    echo.
    timeout /t 10 /nobreak >nul
    goto CHECK_DOCKER
)

echo [SUCCESS] Docker is running!
echo.

REM Check if backend container exists
docker ps -a | findstr parshu-backend-1 >nul 2>&1
if errorlevel 1 (
    echo [WARNING] Backend container not found. Starting containers...
    cd ..\..
    docker-compose up -d
    echo [INFO] Waiting 30s for containers to be healthy...
    timeout /t 30 /nobreak >nul
)

REM Check if backend is healthy
docker inspect --format='{{.State.Health.Status}}' parshu-backend-1 2>nul | findstr healthy >nul 2>&1
if errorlevel 1 (
    echo [WARNING] Backend container not healthy yet. Waiting...
    timeout /t 15 /nobreak >nul
)

echo [SUCCESS] Docker environment is ready!
echo.
echo ========================================================================
echo Running Day 3 Production-Ready Setup
echo ========================================================================
echo.

REM Run the production-ready script
call "%~dp0production-ready-day3.bat"

exit /b %ERRORLEVEL%
