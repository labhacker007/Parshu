@echo off
REM ==================================================================
REM  JYOTI - ONE-COMMAND FIX
REM  Run this if you see a black screen or any issues
REM ==================================================================

echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║          JYOTI - Automated Fix (One Command)              ║
echo ╚════════════════════════════════════════════════════════════╝
echo.
echo [1/5] Stopping containers...
docker-compose down

echo [2/5] Rebuilding frontend (this may take 5-10 minutes)...
docker-compose build --no-cache frontend

echo [3/5] Starting all containers...
docker-compose up -d

echo [4/5] Waiting 20 seconds for startup...
timeout /t 20 /nobreak >nul

echo [5/5] Restarting backend (fixes API issues)...
docker restart parshu-backend-1
timeout /t 10 /nobreak >nul

echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║                      ✓ FIXED!                             ║
echo ╚════════════════════════════════════════════════════════════╝
echo.
echo 📍 Open in browser: http://localhost:3000
echo.
echo 🔐 Login credentials:
echo    Email:    admin@huntsphere.local
echo    Password: Admin123!@2026
echo.
echo 💡 If still black screen:
echo    1. Press Ctrl+Shift+R in browser (hard refresh)
echo    2. Open DevTools (F12) and check Console tab for errors
echo    3. Run this script again: FIX-NOW.bat
echo.
pause
