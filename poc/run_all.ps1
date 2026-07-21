# Run All — One-click script for IMT PoC
# =======================================
# Prerequisites:
#   1. Docker Desktop running (restart machine if containers won't start)
#   2. Python 3.12+ with pip
#   3. .env file configured (copy from .env.example)
#
# Usage:  powershell -ExecutionPolicy Bypass -File run_all.ps1

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   IMT PoC — Incident Ticket Intelligent Retrieval           ║" -ForegroundColor Cyan
Write-Host "║   One-Click Setup & E2E Validation                          ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ── Step 1: Clean ─────────────────────────────────────────────────
Write-Host "[1/6] Cleaning up stale containers & volumes ..." -ForegroundColor Yellow
docker compose down -v 2>$null
docker rm -f imt-poc-db imt-poc-db2 2>$null
Write-Host "       Clean." -ForegroundColor Green

# ── Step 2: Start PostgreSQL ──────────────────────────────────────
Write-Host "[2/6] Starting PostgreSQL 18 + pgvector ..." -ForegroundColor Yellow
docker compose up -d --wait --wait-timeout 30 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    docker compose up -d 2>&1
    Write-Host "       Waiting for healthy ..." -ForegroundColor Gray
    Start-Sleep -Seconds 8
}
$status = docker inspect imt-poc-db --format '{{.State.Health.Status}}' 2>$null
Write-Host "       Container status: $status" -ForegroundColor Green

# ── Step 3: Install deps ─────────────────────────────────────────
Write-Host "[3/6] Checking Python dependencies ..." -ForegroundColor Yellow
pip install --user -r requirements.txt --quiet 2>&1 | Out-Null
Write-Host "       Ready." -ForegroundColor Green

# ── Step 4: Seed data ─────────────────────────────────────────────
Write-Host "[4/6] Seeding 20 historical incident tickets ..." -ForegroundColor Yellow
python seed_data.py 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "       ERROR: Seed failed. Check DB connectivity and .env config." -ForegroundColor Red
    exit 1
}
Write-Host "       Done." -ForegroundColor Green

# ── Step 5: E2E Pipeline ──────────────────────────────────────────
Write-Host "[5/6] Running E2E retrieval pipeline (main.py) ..." -ForegroundColor Yellow
python main.py 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "       ERROR: E2E failed." -ForegroundColor Red
    exit 1
}

# ── Step 6: Lifecycle Demo ────────────────────────────────────────
Write-Host ""
Write-Host "[6/6] Running lifecycle demo (demo_lifecycle.py) ..." -ForegroundColor Yellow
python demo_lifecycle.py 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "       ERROR: Lifecycle demo failed." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   All checks passed. PoC validated successfully.             ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
