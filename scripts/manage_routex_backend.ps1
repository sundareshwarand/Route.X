# RouteX — Unified Backend Maintenance Manager
# Easily check status, start, stop, restart, read logs, or manage startup configuration.

param(
    [ValidateSet("status", "start", "stop", "restart", "logs", "test-health", "uninstall")]
    [string]$Action = "status"
)

$ErrorActionPreference = "Continue"

$projectRoot = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path "$projectRoot\backend\app\main.py")) {
    $projectRoot = "C:\Users\Sundareshwaran\Desktop\Route.X"
}

$scriptsDir = Join-Path $projectRoot "scripts"
$logDir     = Join-Path $projectRoot "logs"
$stdoutLog  = Join-Path $logDir "routex_backend_stdout.log"
$stderrLog  = Join-Path $logDir "routex_backend_stderr.log"

switch ($Action) {
    "status" {
        & "$scriptsDir\check_routex_backend.ps1"
    }
    "start" {
        & "$scriptsDir\start_routex_backend.ps1"
    }
    "stop" {
        & "$scriptsDir\stop_routex_backend.ps1"
    }
    "restart" {
        & "$scriptsDir\restart_routex_backend.ps1"
    }
    "test-health" {
        Write-Host "[*] Testing RouteX Health Probes..." -ForegroundColor Cyan
        try {
            $sw = [System.Diagnostics.Stopwatch]::StartNew()
            $h = Invoke-RestMethod -Uri "http://127.0.0.1:8000/" -TimeoutSec 2 -ErrorAction Stop
            $sw.Stop()
            Write-Host "[OK] http://127.0.0.1:8000/ -> Status: $($h.status) (Latency: $($sw.ElapsedMilliseconds) ms)" -ForegroundColor Green
            Write-Host "     System: $($h.system)"
            Write-Host "     Version: $($h.version)"
        } catch {
            Write-Host "[FAIL] http://127.0.0.1:8000/ -> $($_.Exception.Message)" -ForegroundColor Red
        }

        # Check LAN IPs
        $lanIps = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notmatch '^(169\.254|127\.)' }).IPAddress
        foreach ($ip in $lanIps) {
            try {
                $lh = Invoke-RestMethod -Uri "http://${ip}:8000/" -TimeoutSec 2 -ErrorAction Stop
                Write-Host "[OK] http://${ip}:8000/ -> Status: $($lh.status)" -ForegroundColor Green
            } catch {
                Write-Host "[WARN] http://${ip}:8000/ -> Timed out / Unreachable" -ForegroundColor Yellow
            }
        }
    }
    "logs" {
        Write-Host "==========================================================" -ForegroundColor Cyan
        Write-Host "                RouteX Live Logs (Tail 25)               " -ForegroundColor Cyan
        Write-Host "==========================================================" -ForegroundColor Cyan
        if (Test-Path $stdoutLog) {
            Write-Host "`n--- STDOUT ($stdoutLog) ---" -ForegroundColor Yellow
            Get-Content $stdoutLog -Tail 25
        } else {
            Write-Host "No stdout log found at $stdoutLog" -ForegroundColor Gray
        }

        if (Test-Path $stderrLog) {
            Write-Host "`n--- STDERR ($stderrLog) ---" -ForegroundColor Yellow
            Get-Content $stderrLog -Tail 25
        } else {
            Write-Host "No stderr log found at $stderrLog" -ForegroundColor Gray
        }
        Write-Host "==========================================================" -ForegroundColor Cyan
    }
    "uninstall" {
        & "$scriptsDir\uninstall_routex_service.ps1"
    }
}
