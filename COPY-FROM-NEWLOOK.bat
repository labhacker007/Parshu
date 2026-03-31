@echo off
REM ==================================================================
REM  Copy Working Frontend from New-look Branch
REM  This gets you a working login page immediately
REM ==================================================================

echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║     Copying Working UI from New-look Branch                ║
echo ╚════════════════════════════════════════════════════════════╝
echo.

cd /d "%~dp0"

echo [1/5] Copying LoginPage from New-look...
git show New-look:frontend/src/sections/LoginPage.jsx > frontend\src\sections\LoginPage_newlook.jsx
if exist frontend\src\sections\LoginPage_newlook.jsx (
    copy /Y frontend\src\sections\LoginPage_newlook.jsx frontend\src\sections\LoginPage.jsx
    del frontend\src\sections\LoginPage_newlook.jsx
    echo   ✓ LoginPage copied
) else (
    echo   ✗ Failed to copy LoginPage
)

echo [2/5] Copying Dashboard from New-look...
git show New-look:frontend/src/sections/Dashboard.jsx > frontend\src\sections\Dashboard_newlook.jsx
if exist frontend\src\sections\Dashboard_newlook.jsx (
    copy /Y frontend\src\sections\Dashboard_newlook.jsx frontend\src\sections\Dashboard.jsx
    del frontend\src\sections\Dashboard_newlook.jsx
    echo   ✓ Dashboard copied
) else (
    echo   ✗ Failed to copy Dashboard
)

echo [3/5] Copying theme files from New-look...
git show New-look:frontend/src/themes.js > frontend\src\themes_newlook.js
if exist frontend\src\themes_newlook.js (
    copy /Y frontend\src\themes_newlook.js frontend\src\themes.js
    del frontend\src\themes_newlook.js
    echo   ✓ Themes copied
) else (
    echo   ✗ Failed to copy themes
)

echo [4/5] Copying Sidebar component from New-look...
git show New-look:frontend/src/components/Sidebar.jsx > frontend\src\components\Sidebar_newlook.jsx
if exist frontend\src\components\Sidebar_newlook.jsx (
    copy /Y frontend\src\components\Sidebar_newlook.jsx frontend\src\components\Sidebar.jsx
    del frontend\src\components\Sidebar_newlook.jsx
    echo   ✓ Sidebar copied
) else (
    echo   ✗ Failed to copy Sidebar
)

echo [5/5] Copying theme CSS from New-look...
git show New-look:frontend/src/styles/parshu-theme.css > frontend\src\styles\parshu-theme_newlook.css
if exist frontend\src\styles\parshu-theme_newlook.css (
    copy /Y frontend\src\styles\parshu-theme_newlook.css frontend\src\styles\parshu-theme.css
    del frontend\src\styles\parshu-theme_newlook.css
    echo   ✓ Theme CSS copied
) else (
    echo   ✗ Failed to copy theme CSS
)

echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║              Files Copied Successfully!                    ║
echo ╚════════════════════════════════════════════════════════════╝
echo.
echo Next steps:
echo   1. Run: docker-compose build frontend
echo   2. Run: docker-compose up -d
echo   3. Open: http://localhost:3000
echo.
echo Or just run: FIX-NOW.bat
echo.
pause
