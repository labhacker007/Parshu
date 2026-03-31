@echo off
REM ==================================================================
REM  LOGS - View container logs
REM ==================================================================

echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║                     CONTAINER LOGS                         ║
echo ╚════════════════════════════════════════════════════════════╝
echo.

cd /d "%~dp0"

set CONTAINER=%1
if "%CONTAINER%"=="" set CONTAINER=all

if "%CONTAINER%"=="all" (
    echo Showing logs for all containers (Ctrl+C to stop)...
    docker-compose logs -f
) else if "%CONTAINER%"=="backend" (
    echo Showing backend logs (Ctrl+C to stop)...
    docker logs -f parshu-backend-1
) else if "%CONTAINER%"=="frontend" (
    echo Showing frontend logs (Ctrl+C to stop)...
    docker logs -f parshu-frontend-1
) else (
    echo Unknown container: %CONTAINER%
    echo Usage: LOGS.bat [backend^|frontend^|all]
    pause
    exit /b 1
)
