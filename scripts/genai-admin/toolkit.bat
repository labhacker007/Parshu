@echo off
REM GenAI Admin Toolkit - Windows Wrapper
REM Calls the bash script via Git Bash or WSL

setlocal

set COMMAND=%1
if "%COMMAND%"=="" set COMMAND=help

REM Try Git Bash first
where bash >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    bash "%~dp0toolkit.sh" %*
    exit /b %ERRORLEVEL%
)

REM Try WSL
where wsl >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    wsl bash "%~dp0toolkit.sh" %*
    exit /b %ERRORLEVEL%
)

echo ERROR: Neither Git Bash nor WSL found. Please install one of them.
exit /b 1
