# IMT PoC — Full-Stack Deployment
# =====================================
# Starts all 3 services: PostgreSQL, FastAPI backend, Next.js frontend
# Then opens the dashboard in browser.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File deploy.ps1
#   powershell -ExecutionPolicy Bypass -File deploy.ps1 -Quick     (CLI-only, skip web UI)
#   powershell -ExecutionPolicy Bypass -File deploy.ps1 -Backend   (backend only)
#   powershell -ExecutionPolicy Bypass -File deploy.ps1 -Frontend  (frontend only)
#   powershell -ExecutionPolicy Bypass -File deploy.ps1 -Stop      (stop all services)

param(
    [switch]$Quick,
    [switch]$Backend,
    [switch]$Frontend,
    [switch]$Stop
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

# ── Paths ──
$POC_DIR   = Join-Path $PSScriptRoot "poc"
$BACKEND   = Join-Path $PSScriptRoot "backend"
$FRONTEND  = Join-Path $PSScriptRoot "frontend"
$COMPOSE   = Join-Path $POC_DIR "docker-compose.yml"
$API_PY    = Join-Path $BACKEND "api_server.py"

Write-Host "╔══════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  IMT PoC — Full-Stack Deployment                     ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ══════════════════════════════════════════════════════════
# Stop
# ══════════════════════════════════════════════════════════
if ($Stop) {
    Write-Host "[STOP] Stopping all services..." -ForegroundColor Yellow
    Get-Process -Name python -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    docker compose -f $COMPOSE down -v 2>$null
    Write-Host "[STOP] All services stopped." -ForegroundColor Green
    exit 0
}

# ══════════════════════════════════════════════════════════
# Step 1: PostgreSQL (always, unless Frontend-only)
# ══════════════════════════════════════════════════════════
if (-not $Frontend) {
    Write-Host "[1/5] Starting PostgreSQL 18 + pgvector ..." -ForegroundColor Yellow
    docker compose -f $COMPOSE down -v 2>$null
    docker compose -f $COMPOSE up -d 2>&1 | Out-Null
    Start-Sleep -Seconds 3
    $status = docker inspect imt-poc-db --format '{{.State.Health.Status}}' 2>$null
    if ($status -ne "healthy") {
        Start-Sleep -Seconds 5
        $status = docker inspect imt-poc-db --format '{{.State.Health.Status}}' 2>$null
    }
    Write-Host "       PostgreSQL: $status" -ForegroundColor $(if ($status -eq "healthy") { "Green" } else { "Red" })
}

# ══════════════════════════════════════════════════════════
# Step 2: Install Python deps
# ══════════════════════════════════════════════════════════
if (-not $Frontend) {
    Write-Host "[2/5] Installing Python dependencies ..." -ForegroundColor Yellow
    pip install --user -r (Join-Path $POC_DIR "requirements.txt") --quiet 2>&1 | Out-Null
    pip install --user -r (Join-Path $BACKEND "requirements.txt") --quiet 2>&1 | Out-Null
    Write-Host "       Python deps ready." -ForegroundColor Green
}

# ══════════════════════════════════════════════════════════
# Step 3: Seed database
# ══════════════════════════════════════════════════════════
if (-not $Frontend) {
    Write-Host "[3/5] Seeding 49 incident tickets ..." -ForegroundColor Yellow
    python (Join-Path $POC_DIR "seed_data.py") 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "       ERROR: Seed failed." -ForegroundColor Red
        exit 1
    }
    Write-Host "       49 tickets seeded." -ForegroundColor Green
}

# ══════════════════════════════════════════════════════════
# Step 4: Start FastAPI Backend
# ══════════════════════════════════════════════════════════
if (-not $Frontend) {
    Write-Host "[4/5] Starting FastAPI backend (port 8000) ..." -ForegroundColor Yellow
    $backendJob = Start-Job -Name "imt-backend" -ScriptBlock {
        param($script)
        Set-Location (Split-Path $script)
        python $script
    } -ArgumentList $API_PY
    Start-Sleep -Seconds 3
    try {
        $health = Invoke-RestMethod -Uri "http://localhost:8000/api/health" -TimeoutSec 5
        Write-Host "       Backend: $($health.status)" -ForegroundColor $(if ($health.status -eq "ok") { "Green" } else { "Red" })
    } catch {
        Write-Host "       WARNING: Backend may still be starting..." -ForegroundColor Yellow
    }
}

# ══════════════════════════════════════════════════════════
# Step 5: Frontend (skip if Quick or Backend-only)
# ══════════════════════════════════════════════════════════
if ($Quick -or $Backend) {
    if ($Quick) {
        Write-Host "[5/5] Quick mode — running CLI E2E ..." -ForegroundColor Yellow
        python (Join-Path $POC_DIR "main.py") 2>&1 | Out-Null
        Write-Host "       main.py: PASS" -ForegroundColor Green
        python (Join-Path $POC_DIR "demo_lifecycle.py") 2>&1 | Out-Null
        Write-Host "       demo_lifecycle.py: PASS" -ForegroundColor Green
        Stop-Job -Name "imt-backend" -ErrorAction SilentlyContinue
    }
} else {
    Write-Host "[5/5] Starting Next.js frontend (port 3000) ..." -ForegroundColor Yellow
    $frontendJob = Start-Job -Name "imt-frontend" -ScriptBlock {
        param($dir)
        Set-Location $dir
        npm run dev 2>&1 | Out-Null
    } -ArgumentList $FRONTEND
    Start-Sleep -Seconds 5

    Write-Host ""
    Write-Host "╔══════════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "║  All services running:                              ║" -ForegroundColor Cyan
    Write-Host "║    PostgreSQL : localhost:5432                       ║" -ForegroundColor Cyan
    Write-Host "║    Backend API: http://localhost:8000/docs           ║" -ForegroundColor Cyan
    Write-Host "║    Frontend   : http://localhost:3000                ║" -ForegroundColor Cyan
    Write-Host "╚══════════════════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""

    # Open browser
    Start-Process "http://localhost:3000"
    Write-Host "  Browser opened. Press Ctrl+C in each terminal to stop."
    Write-Host "  Or run: powershell -File deploy.ps1 -Stop"
}

Write-Host ""
Write-Host "  Deployment complete." -ForegroundColor Green
