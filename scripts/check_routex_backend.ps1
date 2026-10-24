# RouteX — Health & Status Inspector
# Checks port 8000, queries the health endpoint, reports process metrics, and displays the LAN URL.

$ErrorActionPreference = "Continue"

$projectRoot = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path "$projectRoot\backend\app\main.py")) {
    $projectRoot = "C:\Users\Sundareshwaran\Desktop\Route.X"
}

$logDir    = Join-Path $projectRoot "logs"
$pidFile   = Join-Path $logDir "routex_backend.pid"
$stdoutLog = Join-Path $logDir "routex_backend_stdout.log"
$stderrLog = Join-Path $logDir "routex_backend_stderr.log"

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "          RouteX Backend Diagnostic Status              " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

# 1. Port 8000 check via netstat & NetTCPConnection
$isListening = $false
$activePid = $null

try {
    $conn = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($conn) {
        $activePid = $conn.OwningProcess
        $isListening = $true
    }
} catch {}

if (-not $isListening) {
    $netstat = netstat -ano | Select-String ":8000\s+.*LISTENING\s+(\d+)"
    if ($netstat) {
        $activePid = [int]$netstat[0].Matches[0].Groups[1].Value
        $isListening = $true
    }
}

if (-not $isListening) {
    Write-Host "[STATUS] Backend is: OFFLINE (Port 8000 is not listening)" -ForegroundColor Red
    Write-Host "Run .\scripts\start_routex_backend.ps1 to launch it."
    Write-Host "========================================================" -ForegroundColor Cyan
    exit 1
}

$proc = Get-Process -Id $activePid -ErrorAction SilentlyContinue

Write-Host "[STATUS] Port 8000 is LISTENING" -ForegroundColor Green
Write-Host "  Process Name : $($proc.Name)"
Write-Host "  Process ID   : $activePid"
if ($proc) {
    $memMb = [math]::Round($proc.WorkingSet64 / 1MB, 2)
    Write-Host "  Memory Usage : $memMb MB"
    Write-Host "  Start Time   : $($proc.StartTime)"
}

# 2. HTTP Health Probe
$stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
try {
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:8000/" -Method Get -TimeoutSec 3 -ErrorAction Stop
    $stopwatch.Stop()
    $ms = $stopwatch.ElapsedMilliseconds
    Write-Host "[HEALTH] HTTP 200 OK ($ms ms latency)" -ForegroundColor Green
    Write-Host "  System Name  : $($health.system)"
    Write-Host "  System Status: $($health.status)"
    Write-Host "  API Version  : $($health.version)"
} catch {
    $stopwatch.Stop()
    Write-Host "[HEALTH] Failed to query HTTP endpoint: $_" -ForegroundColor Red
}

# 3. Detect LAN IP
$lanIp = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notmatch '^(169\.254|127\.|100\.)' }).IPAddress | Select-Object -First 1
if (-not $lanIp) { $lanIp = "127.0.0.1" }

Write-Host ""
Write-Host "[CONNECTIVITY URLS]" -ForegroundColor Cyan
Write-Host "  Local Loopback   : http://127.0.0.1:8000/"
Write-Host "  Swagger Docs     : http://127.0.0.1:8000/docs"
Write-Host "  Local Wi-Fi IP   : $lanIp"
Write-Host "  Android App URL  : http://${lanIp}:8000/api"
Write-Host "  WebSocket URL    : ws://${lanIp}:8000/ws"

# 4. Log files tail
Write-Host ""
Write-Host "[RECENT LOGS]" -ForegroundColor Cyan
if (Test-Path $stdoutLog) {
    Write-Host "--- Last 5 lines of stdout.log ---" -ForegroundColor DarkGray
    Get-Content $stdoutLog -Tail 5 | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
}
if (Test-Path $stderrLog) {
    $errors = Get-Content $stderrLog -Tail 5 -ErrorAction SilentlyContinue
    if ($errors) {
        Write-Host "--- Last 5 lines of stderr.log ---" -ForegroundColor DarkGray
        $errors | ForEach-Object { Write-Host "  $_" -ForegroundColor Yellow }
    }
}
# 5. Scheduled Task Status
Write-Host ""
Write-Host "[SCHEDULED TASK STATUS]" -ForegroundColor Cyan
try {
    $task = Get-ScheduledTask -TaskName "RouteX_FastAPI_Backend" -ErrorAction SilentlyContinue
    if ($task) {
        $taskInfo = Get-ScheduledTaskInfo -TaskName "RouteX_FastAPI_Backend" -ErrorAction SilentlyContinue
        Write-Host "  Task Name    : $($task.TaskName)" -ForegroundColor Green
        Write-Host "  State        : $($task.State)"
        Write-Host "  Last Run Time: $($taskInfo.LastRunTime)"
        Write-Host "  Last Result  : 0x$($taskInfo.LastTaskResult.ToString('X'))"
    } else {
        Write-Host "  Task 'RouteX_FastAPI_Backend' is NOT registered." -ForegroundColor Yellow
    }
} catch {
    Write-Host "  Unable to query Task Scheduler." -ForegroundColor Yellow
}
Write-Host "========================================================" -ForegroundColor Cyan
