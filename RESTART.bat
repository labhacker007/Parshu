@echo off
REM ==================================================================
REM  RESTART - Quick restart without rebuilding
REM  Use this for backend changes that don't need full rebuild
REM ==================================================================

echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║          RESTART - Quick Container Restart                ║
echo ╚════════════════════════════════════════════════════════════╝
echo.

cd /d "%~dp0"

set CONTAINER=%1
if "%CONTAINER%"=="" set CONTAINER=all

if "%CONTAINER%"=="all" (
    echo Restarting all containers...
    docker restart parshu-backend-1 parshu-frontend-1
) else if "%CONTAINER%"=="backend" (
    echo Restarting backend only...
    docker restart parshu-backend-1
) else if "%CONTAINER%"=="frontend" (
    echo Restarting frontend only...
    docker restart parshu-frontend-1
) else (
    echo Unknown container: %CONTAINER%
    echo Usage: RESTART.bat [backend^|frontend^|all]
    pause
    exit /b 1
)

timeout /t 10 /nobreak >nul

echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║                    ✓ RESTART COMPLETE!                    ║
echo ╚════════════════════════════════════════════════════════════╝
echo.
echo 📍 Check status:
docker ps --format "table {{.Names}}\t{{.Status}}"
echo.
pause
