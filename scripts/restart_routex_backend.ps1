# RouteX — Backend Process Restarter
# Gracefully stops the active backend and restarts it cleanly with health check.

$projectRoot = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path "$projectRoot\backend\app\main.py")) {
    $projectRoot = "C:\Users\Sundareshwaran\Desktop\Route.X"
}

Write-Host "[1/2] Stopping active RouteX backend..." -ForegroundColor Cyan
& "$PSScriptRoot\stop_routex_backend.ps1"

Start-Sleep -Seconds 1

Write-Host "[2/2] Starting RouteX backend..." -ForegroundColor Cyan
& "$PSScriptRoot\start_routex_backend.ps1"
