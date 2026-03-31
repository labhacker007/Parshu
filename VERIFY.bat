@echo off
REM ==================================================================
REM  VERIFY - Quick verification that all Jyoti features are working
REM  Use after a rebuild to verify nothing is broken
REM ==================================================================

cd /d "%~dp0"

echo.
echo ==============================================================
echo  JYOTI VERIFY - Feature Verification Suite
echo ==============================================================
echo.

set PASS=0
set FAIL=0
set TOTAL=0

REM Helper: test an endpoint
REM We test each endpoint and track pass/fail

echo === Backend Core ===

REM Test 1: Health
set /a TOTAL+=1
curl -sf http://localhost:8000/health >nul 2>&1 && (echo   [PASS] /health & set /a PASS+=1) || (echo   [FAIL] /health & set /a FAIL+=1)

REM Test 2: Root
set /a TOTAL+=1
curl -sf http://localhost:8000/ >nul 2>&1 && (echo   [PASS] / & set /a PASS+=1) || (echo   [FAIL] / & set /a FAIL+=1)

REM Test 3: Metrics
set /a TOTAL+=1
curl -sf http://localhost:8000/metrics >nul 2>&1 && (echo   [PASS] /metrics & set /a PASS+=1) || (echo   [FAIL] /metrics & set /a FAIL+=1)

REM Test 4: Docs
set /a TOTAL+=1
curl -sf http://localhost:8000/docs >nul 2>&1 && (echo   [PASS] /docs & set /a PASS+=1) || (echo   [FAIL] /docs & set /a FAIL+=1)

REM Test 5: OpenAPI
set /a TOTAL+=1
curl -sf http://localhost:8000/openapi.json >nul 2>&1 && (echo   [PASS] /openapi.json & set /a PASS+=1) || (echo   [FAIL] /openapi.json & set /a FAIL+=1)

echo.
echo === Authentication ===

REM Test 6: Login endpoint (should return 422 for empty body)
set /a TOTAL+=1
for /f %%c in ('curl -so nul -w "%%{http_code}" -X POST http://localhost:8000/auth/login -H "Content-Type: application/json" -d "{}" 2^>nul') do set HTTP_CODE=%%c
if "%HTTP_CODE%"=="422" (echo   [PASS] POST /auth/login (422 validation) & set /a PASS+=1) else (echo   [FAIL] POST /auth/login (got %HTTP_CODE%) & set /a FAIL+=1)

REM Test 7: Register endpoint
set /a TOTAL+=1
for /f %%c in ('curl -so nul -w "%%{http_code}" -X POST http://localhost:8000/auth/register -H "Content-Type: application/json" -d "{}" 2^>nul') do set HTTP_CODE=%%c
if "%HTTP_CODE%"=="422" (echo   [PASS] POST /auth/register (422 validation) & set /a PASS+=1) else (echo   [FAIL] POST /auth/register (got %HTTP_CODE%) & set /a FAIL+=1)

echo.
echo === Protected Endpoints (expect 401) ===

REM Test 8-15: Protected endpoints should return 401
for %%e in ("/sources/" "/articles/triage" "/watchlist/" "/users/" "/audit/" "/users/watchlist/" "/users/feeds/" "/users/categories/") do (
    set /a TOTAL+=1
    for /f %%c in ('curl -so nul -w "%%%%{http_code}" http://localhost:8000%%~e 2^>nul') do set HTTP_CODE=%%c
    if "!HTTP_CODE!"=="401" (echo   [PASS] GET %%~e ^(401 auth required^) & set /a PASS+=1) else (echo   [FAIL] GET %%~e ^(got !HTTP_CODE!^) & set /a FAIL+=1)
)

echo.
echo === Frontend ===

REM Test: Frontend responding
set /a TOTAL+=1
curl -sf http://localhost:3000 >nul 2>&1 && (echo   [PASS] Frontend http://localhost:3000 & set /a PASS+=1) || (echo   [FAIL] Frontend http://localhost:3000 & set /a FAIL+=1)

echo.
echo ==============================================================
echo  Results: %PASS%/%TOTAL% passed, %FAIL% failed
echo ==============================================================
echo.

if %FAIL%==0 (
    echo  All checks passed! Jyoti is fully operational.
) else (
    echo  Some checks failed. Run AUTOHEAL.bat to fix issues.
)
echo.
pause
