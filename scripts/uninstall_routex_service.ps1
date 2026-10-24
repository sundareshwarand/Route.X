# RouteX — Uninstaller for Automatic Startup & Background Service
# Removes Windows Scheduled Task, Startup folder launcher, and stops running backend processes.

$ErrorActionPreference = "Continue"

$projectRoot = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path "$projectRoot\backend\app\main.py")) {
    $projectRoot = "C:\Users\Sundareshwaran\Desktop\Route.X"
}

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "       RouteX Background Service Uninstaller           " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

# 1. Stop active process
Write-Host "[1/3] Stopping active backend process..."
& "$PSScriptRoot\stop_routex_backend.ps1"

# 2. Remove Startup folder launcher
Write-Host "[2/3] Checking Windows Startup folder..."
$startupDir = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Startup)
$vbsPath    = Join-Path $startupDir "RouteX_AutoStart.vbs"
if (Test-Path $vbsPath) {
    Remove-Item $vbsPath -Force -ErrorAction SilentlyContinue
    Write-Host "  [OK] Removed $vbsPath" -ForegroundColor Green
} else {
    Write-Host "  [--] No Startup folder launcher found."
}

# 3. Remove Task Scheduler task if present
Write-Host "[3/3] Checking Windows Task Scheduler..."
$taskName = "RouteX_FastAPI_Backend"
$task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($task) {
    # Check admin privileges to unregister
    $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    if ($isAdmin) {
        Unregister-ScheduledTask -TaskName $taskName -Confirm:$false | Out-Null
        Write-Host "  [OK] Removed Scheduled Task '$taskName'" -ForegroundColor Green
    } else {
        Write-Warning "Task '$taskName' exists but requires Administrator rights to unregister."
        Write-Host "Please run this command in an Administrator PowerShell prompt:"
        Write-Host "  Unregister-ScheduledTask -TaskName '$taskName' -Confirm:`$false" -ForegroundColor Yellow
    }
} else {
    Write-Host "  [--] No scheduled task '$taskName' found."
}

Write-Host ""
Write-Host "[SUCCESS] RouteX automatic background service has been uninstalled." -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Cyan
