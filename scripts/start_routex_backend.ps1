# RouteX — Persistent Background Server Starter
# Starts FastAPI/Uvicorn on 0.0.0.0:8000 in background without opening a terminal window.

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path "$projectRoot\backend\app\main.py")) {
    $projectRoot = "C:\Users\Sundareshwaran\Desktop\Route.X"
}

$backendDir = Join-Path $projectRoot "backend"
$logDir     = Join-Path $projectRoot "logs"
$pidFile    = Join-Path $logDir "routex_backend.pid"
$stdoutLog  = Join-Path $logDir "routex_backend_stdout.log"
$stderrLog  = Join-Path $logDir "routex_backend_stderr.log"

if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Force -Path $logDir | Out-Null
}

# 1. Resolve Python executable
$pythonExe = "C:\Users\Sundareshwaran\AppData\Local\Programs\Python\Python312\python.exe"
if (-not (Test-Path $pythonExe)) {
    $cmd = Get-Command python -ErrorAction SilentlyContinue
    if ($cmd) {
        $pythonExe = $cmd.Source
    } else {
        Write-Error "Python executable not found. Please install Python 3.12 or ensure it is in PATH."
        exit 1
    }
}

# 2. Check if RouteX backend is already running and healthy
$isListening = $false
$existingPids = @()

try {
    $conns = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue
    if ($conns) {
        $existingPids += $conns.OwningProcess
        $isListening = $true
    }
} catch {}

if (-not $isListening) {
    $netstat = netstat -ano | Select-String ":8000\s+.*LISTENING\s+(\d+)"
    foreach ($m in $netstat) {
        $pidMatch = [int]$m.Matches[0].Groups[1].Value
        if ($pidMatch -gt 0) {
            $existingPids += $pidMatch
            $isListening = $true
        }
    }
}

if ($isListening) {
    try {
        $health = Invoke-RestMethod -Uri "http://127.0.0.1:8000/" -Method Get -TimeoutSec 2 -ErrorAction Stop
        if ($health.status -eq "ONLINE") {
            $mainPid = $existingPids | Select-Object -First 1
            Write-Host "[OK] RouteX backend is already running and healthy (PID: $mainPid, Status: $($health.status)). No action needed."
            Set-Content -Path $pidFile -Value $mainPid -Force
            exit 0
        }
    } catch {
        Write-Warning "Port 8000 is open but did not respond to health check. Attempting clean launch..."
    }
}

# 3. Clean up stale PID file
if (Test-Path $pidFile) {
    Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
}

# 4. Launch Uvicorn in background via WMI (completely detached from parent console)
$launchCmd = "cmd.exe /c cd /d `"$backendDir`" && `"$pythonExe`" -m uvicorn app.main:app --host 0.0.0.0 --port 8000 >> `"$stdoutLog`" 2>> `"$stderrLog`""

$wmiResult = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{
    CommandLine = $launchCmd
    CurrentDirectory = $backendDir
}

if ($wmiResult.ReturnValue -ne 0) {
    Write-Error "Failed to launch backend process via WMI. Error code: $($wmiResult.ReturnValue)"
    exit 1
}

Write-Host "[+] Launched background worker process (Wrapper PID: $($wmiResult.ProcessId))"

# 5. Health verification loop (wait up to 12 seconds)
$maxAttempts = 24
$healthy = $false
$realPid = $null

for ($i = 1; $i -le $maxAttempts; $i++) {
    Start-Sleep -Milliseconds 500

    try {
        $res = Invoke-RestMethod -Uri "http://127.0.0.1:8000/" -Method Get -TimeoutSec 1 -ErrorAction Stop
        if ($res.status -eq "ONLINE") {
            $healthy = $true
            # Find the actual python process listening on port 8000
            $netstat = netstat -ano | Select-String ":8000\s+.*LISTENING\s+(\d+)"
            if ($netstat) {
                $realPid = [int]$netstat[0].Matches[0].Groups[1].Value
                Set-Content -Path $pidFile -Value $realPid -Force
            }
            break
        }
    } catch {}
}

if ($healthy) {
    # Detect local LAN IP (e.g. 192.168.1.5 or 192.168.1.9)
    $lanIp = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notmatch '^(169\.254|127\.|100\.)' }).IPAddress | Select-Object -First 1
    if (-not $lanIp) { $lanIp = "127.0.0.1" }

    Write-Host "[SUCCESS] RouteX Backend is ONLINE and healthy!" -ForegroundColor Green
    Write-Host "  - Local Health:   http://127.0.0.1:8000/"
    Write-Host "  - Swagger Docs:   http://127.0.0.1:8000/docs"
    Write-Host "  - Local Wi-Fi IP: $lanIp"
    Write-Host "  - Android API:    http://${lanIp}:8000/api"
    Write-Host "  - WebSocket URL:  ws://${lanIp}:8000/ws"
    Write-Host "  - Process ID:     $realPid"
    Write-Host "  - Stdout Log:     $stdoutLog"
    Write-Host "  - Stderr Log:     $stderrLog"
    exit 0
} else {
    Write-Error "Backend launched but failed to pass health check within 12 seconds."
    if (Test-Path $stderrLog) {
        Write-Host "--- Last 10 lines of stderr ---"
        Get-Content $stderrLog -Tail 10
    }
    exit 1
}
