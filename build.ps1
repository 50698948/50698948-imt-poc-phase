# IMT PoC — Docker Build & Deploy
# ================================
# Builds all Docker images and starts the full stack.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File build.ps1
#   powershell -ExecutionPolicy Bypass -File build.ps1 -Reset   (rebuild from scratch)
#   powershell -ExecutionPolicy Bypass -File build.ps1 -Prod    (production mode)

param(
    [switch]$Reset,
    [switch]$Prod
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$DOCKER_COMPOSE = Join-Path $PSScriptRoot "deploy" "docker-compose.yml"

Write-Host "╔══════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  IMT PoC — Docker Build & Deploy                     ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

if ($Reset) {
    Write-Host "[RESET] Cleaning all containers, images, and volumes..." -ForegroundColor Yellow
    docker compose -f $DOCKER_COMPOSE down -v --rmi all 2>$null
    Write-Host "[RESET] Clean." -ForegroundColor Green
}

# ── Build ──
Write-Host "[1/3] Building Docker images ..." -ForegroundColor Yellow
docker compose -f $DOCKER_COMPOSE build --no-cache 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "       Build failed." -ForegroundColor Red
    exit 1
}
Write-Host "       Build complete." -ForegroundColor Green

# ── Start ──
Write-Host "[2/3] Starting services ..." -ForegroundColor Yellow
docker compose -f $DOCKER_COMPOSE up -d 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "       Startup failed." -ForegroundColor Red
    exit 1
}

# ── Wait for healthy ──
Write-Host "[3/3] Waiting for services to be healthy ..." -ForegroundColor Yellow
$tries = 0
do {
    Start-Sleep -Seconds 3
    $postgres = docker inspect imt-postgres --format '{{.State.Health.Status}}' 2>$null
    $backend = docker inspect imt-backend --format '{{.State.Health.Status}}' 2>$null
    $frontend = docker inspect imt-frontend --format '{{.State.Status}}' 2>$null
    $tries++
    if ($tries -gt 20) { break }
} while ($postgres -ne "healthy" -or $backend -ne "healthy" -or $frontend -ne "running")

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  Services Running:                                  ║" -ForegroundColor Cyan
Write-Host "║    PostgreSQL : $postgres                                         ║" -ForegroundColor Cyan
Write-Host "║    Backend API: $backend                                         ║" -ForegroundColor Cyan
Write-Host "║    Frontend   : $frontend                                         ║" -ForegroundColor Cyan
Write-Host "╠══════════════════════════════════════════════════════╣" -ForegroundColor Cyan
Write-Host "║    http://localhost:3000  (Web UI)                   ║" -ForegroundColor Cyan
Write-Host "║    http://localhost:8000/docs  (API Docs)            ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════╝" -ForegroundColor Cyan

if (-not $Prod) {
    Start-Process "http://localhost:3000"
}

Write-Host ""
Write-Host "  To stop:  docker compose -f deploy/docker-compose.yml down" -ForegroundColor Gray
Write-Host "  To reset: powershell -File build.ps1 -Reset" -ForegroundColor Gray
