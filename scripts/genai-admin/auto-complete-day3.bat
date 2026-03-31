@echo off
REM Fully Automated Day 3 Production Setup
REM Lazy engineer mode: Handles everything including starting Docker

echo ========================================================================
echo Fully Automated Day 3 Production Setup
echo ========================================================================
echo.

REM Step 1: Check if Docker is running
echo [INFO] Checking Docker status...
docker ps >nul 2>&1
if errorlevel 1 (
    echo [WARNING] Docker is not running. Starting Docker Desktop...

    REM Try common Docker Desktop installation paths
    set DOCKER_EXE=

    if exist "C:\Program Files\Docker\Docker\Docker Desktop.exe" (
        set DOCKER_EXE=C:\Program Files\Docker\Docker\Docker Desktop.exe
    ) else if exist "%ProgramFiles%\Docker\Docker\Docker Desktop.exe" (
        set DOCKER_EXE=%ProgramFiles%\Docker\Docker\Docker Desktop.exe
    ) else if exist "%LOCALAPPDATA%\Docker\Docker Desktop.exe" (
        set DOCKER_EXE=%LOCALAPPDATA%\Docker\Docker Desktop.exe
    )

    if defined DOCKER_EXE (
        echo [INFO] Found Docker Desktop at: %DOCKER_EXE%
        echo [INFO] Starting Docker Desktop...
        start "" "%DOCKER_EXE%"

        echo [INFO] Waiting for Docker to be ready...
        set MAX_WAIT=120
        set COUNTER=0

        :WAIT_DOCKER
        timeout /t 5 /nobreak >nul
        set /a COUNTER+=5

        docker ps >nul 2>&1
        if errorlevel 1 (
            if %COUNTER% LSS %MAX_WAIT% (
                echo [INFO] Still waiting... (%COUNTER%s / %MAX_WAIT%s^)
                goto WAIT_DOCKER
            ) else (
                echo [ERROR] Docker failed to start within %MAX_WAIT% seconds
                echo [ERROR] Please start Docker Desktop manually and run:
                echo [ERROR]   scripts\genai-admin\production-ready-day3.bat
                exit /b 1
            )
        )

        echo [SUCCESS] Docker is now running!
    ) else (
        echo [ERROR] Docker Desktop not found in common installation paths
        echo [ERROR] Please install Docker Desktop or start it manually
        echo.
        echo Common paths checked:
        echo   - C:\Program Files\Docker\Docker\Docker Desktop.exe
        echo   - %LOCALAPPDATA%\Docker\Docker Desktop.exe
        exit /b 1
    )
) else (
    echo [SUCCESS] Docker is already running
)

echo.
echo ========================================================================
echo Docker is ready. Starting production setup...
echo ========================================================================
echo.

REM Step 2: Ensure containers are running
cd ..\..
echo [INFO] Checking containers...
docker-compose ps | findstr parshu-backend-1 | findstr Up >nul 2>&1
if errorlevel 1 (
    echo [INFO] Starting containers...
    docker-compose up -d
    echo [INFO] Waiting 30s for services to be healthy...
    timeout /t 30 /nobreak >nul
)

REM Step 3: Wait for backend to be healthy
echo [INFO] Waiting for backend to be healthy...
set MAX_WAIT=60
set COUNTER=0

:WAIT_HEALTHY
timeout /t 5 /nobreak >nul
set /a COUNTER+=5

curl -s http://localhost:8000/health >nul 2>&1
if errorlevel 1 (
    if %COUNTER% LSS %MAX_WAIT% (
        echo [INFO] Backend not ready yet... (%COUNTER%s / %MAX_WAIT%s^)
        goto WAIT_HEALTHY
    ) else (
        echo [WARNING] Backend health check timeout, proceeding anyway...
    )
) else (
    echo [SUCCESS] Backend is healthy!
)

echo.
echo ========================================================================
echo Running Production-Ready Setup
echo ========================================================================
echo.

REM Step 4: Run production-ready script
cd scripts\genai-admin
call production-ready-day3.bat

exit /b %ERRORLEVEL%
