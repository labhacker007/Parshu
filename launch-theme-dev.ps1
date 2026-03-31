#!/usr/bin/env pwsh
# =============================================================================
# THEME DEV LAUNCHER
# Builds and launches the themed version of Parshu
# =============================================================================

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$Green = "$([char]27)[32m"
$Yellow = "$([char]27)[33m"
$Cyan = "$([char]27)[36m"
$Reset = "$([char]27)[0m"

$ProjectDir = "C:\Users\tarun\OneDrive\Master\Tarun\Documents\Pulser\Parshu"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "PARSHU THEME DEV - Launch Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if we're on the right branch
cd $ProjectDir
$branch = git branch --show-current
Write-Host "Branch: $branch" -ForegroundColor Yellow

if ($branch -ne "feature/new-look-theme") {
    Write-Host "WARNING: Not on feature/new-look-theme branch" -ForegroundColor Red
    Write-Host "Switching..." -ForegroundColor Yellow
    git checkout feature/new-look-theme 2>&1 | Out-Null
}

Write-Host ""
Write-Host "[1/5] Checking Docker..." -ForegroundColor Yellow
docker ps 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Docker not running" -ForegroundColor Red
    exit 1
}
Write-Host "      Docker OK" -ForegroundColor Green

Write-Host "[2/5] Stopping existing containers..." -ForegroundColor Yellow
docker-compose down 2>&1 | Out-Null
docker stop $(docker ps -q --filter "name=parshu-theme") 2>$null | Out-Null
Write-Host "      Done" -ForegroundColor Green

Write-Host "[3/5] Building containers..." -ForegroundColor Yellow
cd $ProjectDir
docker-compose up -d --build 2>&1 | Select-Object -Last 10
Write-Host "      Build complete" -ForegroundColor Green

Write-Host "[4/5] Waiting for services..." -ForegroundColor Yellow
$attempts = 0
$maxAttempts = 30
$backendReady = $false
$frontendReady = $false

while ($attempts -lt $maxAttempts -and (-not $backendReady -or -not $frontendReady)) {
    Start-Sleep -Seconds 2
    $attempts++
    
    # Check backend
    if (-not $backendReady) {
        try {
            $be = Invoke-RestMethod -Uri "http://localhost:8000/health" -TimeoutSec 2 -ErrorAction SilentlyContinue
            if ($be.status -eq "healthy") {
                $backendReady = $true
                Write-Host "      Backend ready" -ForegroundColor Green
            }
        } catch {}
    }
    
    # Check frontend
    if (-not $frontendReady) {
        try {
            $fe = Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
            if ($fe.StatusCode -eq 200) {
                $frontendReady = $true
                Write-Host "      Frontend ready" -ForegroundColor Green
            }
        } catch {}
    }
    
    if ($attempts % 5 -eq 0) {
        Write-Host "      Waiting... ($attempts/$maxAttempts)" -ForegroundColor Gray
    }
}

Write-Host "[5/5] Final verification..." -ForegroundColor Yellow
$backendStatus = docker ps --filter "name=parshu-backend" --format "{{.Status}}" 2>$null
$frontendStatus = docker ps --filter "name=parshu-frontend" --format "{{.Status}}" 2>$null

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
if ($backendReady -and $frontendReady) {
    Write-Host "SUCCESS! Theme Dev Environment Ready" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "URLs:" -ForegroundColor Yellow
    Write-Host "  Frontend: http://localhost:3000" -ForegroundColor White
    Write-Host "  Backend:  http://localhost:8000" -ForegroundColor White
    Write-Host "  API Docs: http://localhost:8000/docs" -ForegroundColor White
    Write-Host ""
    Write-Host "Start developing! Edit files in:" -ForegroundColor Yellow
    Write-Host "  $ProjectDir\frontend\src" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "The theme files are already in place:" -ForegroundColor Yellow
    Write-Host "  - src/styles/themes/ (3 theme system)" -ForegroundColor Gray
    Write-Host "  - src/components/layout/ (NewHeader, NewSidebar)" -ForegroundColor Gray
    Write-Host "  - src/pages/new-dashboard/ (Dashboard with themes)" -ForegroundColor Gray
} else {
    Write-Host "PARTIAL SUCCESS" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Backend: $backendStatus" -ForegroundColor Gray
    Write-Host "Frontend: $frontendStatus" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Check logs: docker-compose logs -f" -ForegroundColor Yellow
}
Write-Host ""
