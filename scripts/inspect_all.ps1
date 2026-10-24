# RouteX System Status Inspection Script
$ErrorActionPreference = "Continue"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "            RouteX System Inspection Report               " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Port 8000 & Process
Write-Host "[1/7] Inspecting Port 8000 Listener & Active Process..." -ForegroundColor Yellow
$conn = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue
if ($conn) {
    $proc = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
    Write-Host "  Port 8000 is LISTENING" -ForegroundColor Green
    Write-Host "  Owning PID: $($conn.OwningProcess)"
    Write-Host "  Process Name: $($proc.ProcessName)"
    Write-Host "  Process Path: $($proc.Path)"
    Write-Host "  Working Set: $([math]::Round($proc.WorkingSet64 / 1MB, 2)) MB"
    Write-Host "  Start Time: $($proc.StartTime)"
} else {
    Write-Host "  Port 8000 is NOT listening." -ForegroundColor Red
}

# 2. Local HTTP Health Check
Write-Host "`n[2/7] Checking Local API Health (http://127.0.0.1:8000/)..." -ForegroundColor Yellow
try {
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:8000/" -TimeoutSec 2 -ErrorAction Stop
    $sw.Stop()
    Write-Host "  Health Status: $($health.status) (Latency: $($sw.ElapsedMilliseconds) ms)" -ForegroundColor Green
    Write-Host "  System: $($health.system)"
    Write-Host "  Version: $($health.version)"
} catch {
    Write-Host "  Health check failed: $($_.Exception.Message)" -ForegroundColor Red
}

# 3. LAN IP & Health Check
Write-Host "`n[3/7] Checking LAN Connectivity..." -ForegroundColor Yellow
$lanIps = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notmatch '^(169\.254|127\.)' }).IPAddress
foreach ($ip in $lanIps) {
    try {
        $lanHealth = Invoke-RestMethod -Uri "http://${ip}:8000/" -TimeoutSec 2 -ErrorAction Stop
        Write-Host "  LAN IP http://${ip}:8000/ -> ONLINE (Status: $($lanHealth.status))" -ForegroundColor Green
    } catch {
        Write-Host "  LAN IP http://${ip}:8000/ -> Unreachable / Timed out" -ForegroundColor Red
    }
}

# 4. User Startup Folder Launcher
Write-Host "`n[4/7] Checking Windows User Startup Folder..." -ForegroundColor Yellow
$userStartup = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\Startup\RouteX_AutoStart.vbs"
if (Test-Path $userStartup) {
    Write-Host "  FOUND: $userStartup" -ForegroundColor Green
    Write-Host "  Contents:"
    Get-Content $userStartup | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray }
} else {
    Write-Host "  NOT FOUND in user Startup folder." -ForegroundColor Gray
}

# 5. Windows Task Scheduler
Write-Host "`n[5/7] Checking Windows Task Scheduler..." -ForegroundColor Yellow
$task = schtasks.exe /query /TN "RouteX_FastAPI_Backend" /fo LIST 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  FOUND Task 'RouteX_FastAPI_Backend':" -ForegroundColor Green
    $task | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray }
} else {
    Write-Host "  Task 'RouteX_FastAPI_Backend' is NOT registered in Task Scheduler." -ForegroundColor Gray
}

# 6. Windows Services
Write-Host "`n[6/7] Checking Windows Services..." -ForegroundColor Yellow
$svcs = Get-Service -Name "*RouteX*" -ErrorAction SilentlyContinue
if ($svcs) {
    $svcs | Format-Table -AutoSize
} else {
    Write-Host "  No native Windows Service found for RouteX." -ForegroundColor Gray
}

# 7. Log Files & Sizes
Write-Host "`n[7/7] Checking Log Files in logs/..." -ForegroundColor Yellow
Get-ChildItem -Path "logs" -ErrorAction SilentlyContinue | Format-Table Name, Length, LastWriteTime -AutoSize
Write-Host "==========================================================" -ForegroundColor Cyan
