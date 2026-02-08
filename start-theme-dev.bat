@echo off
:: PARSHU THEME DEV - Quick Start
cd /d "%~dp0"

echo ========================================
echo PARSHU THEME DEV - Quick Start
echo ========================================
echo.

echo [1/3] Checking services...
docker ps --filter "name=parshu-frontend" --format "{{.Status}}" | findstr "Up" >nul
if %errorlevel% neq 0 (
    echo Starting containers...
    docker-compose up -d
    timeout /t 15 /nobreak >nul
)
echo     Services OK
echo.

echo [2/3] Opening browser...
start http://localhost:3000
echo     Browser opened
echo.

echo [3/3] Status:
curl -s http://localhost:8000/health -w " [HTTP %%{http_code}]" --max-time 3 2>nul
echo.
echo.

echo ========================================
echo THEME DEV READY
echo ========================================
echo.
echo URLs:
echo   Frontend: http://localhost:3000
echo   Backend:  http://localhost:8000
echo   API Docs: http://localhost:8000/docs
echo.
echo Theme Toggle: Click icon in top-right corner
echo.
pause
