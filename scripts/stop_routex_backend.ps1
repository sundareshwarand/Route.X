# RouteX — Backend Process Stopper
# Gracefully terminates the running RouteX FastAPI process and releases port 8000.

$ErrorActionPreference = "Continue"

$projectRoot = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path "$projectRoot\backend\app\main.py")) {
    $projectRoot = "C:\Users\Sundareshwaran\Desktop\Route.X"
}

$logDir  = Join-Path $projectRoot "logs"
$pidFile = Join-Path $logDir "routex_backend.pid"

$pidsToKill = @()

# 1. Read PID from file if available
if (Test-Path $pidFile) {
    $savedPid = Get-Content $pidFile -ErrorAction SilentlyContinue | Out-String
    $savedPid = $savedPid.Trim()
    if ($savedPid -match '^\d+$') {
        $pidsToKill += [int]$savedPid
    }
    Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
}

# 2. Check any process actively listening on port 8000 via NetTCPConnection
try {
    $connections = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue
    foreach ($conn in $connections) {
        if ($conn.OwningProcess -gt 0) {
            $pidsToKill += [int]$conn.OwningProcess
        }
    }
} catch {}

# 3. Check port 8000 via netstat (reliable without elevation)
$netstat = netstat -ano | Select-String ":8000\s+.*LISTENING\s+(\d+)"
foreach ($m in $netstat) {
    $matchedPid = [int]$m.Matches[0].Groups[1].Value
    if ($matchedPid -gt 0) {
        $pidsToKill += $matchedPid
    }
}

$pidsToKill = $pidsToKill | Select-Object -Unique

# 4. Terminate processes
$stoppedAny = $false
foreach ($targetPid in $pidsToKill) {
    $proc = Get-Process -Id $targetPid -ErrorAction SilentlyContinue
    if ($proc) {
        Write-Host "[*] Terminating RouteX process $($proc.Name) (PID: $targetPid)..."
        # taskkill /F /T kills child processes as well
        taskkill /F /T /PID $targetPid 2>$null | Out-Null
        $stoppedAny = $true
    }
}

Start-Sleep -Milliseconds 800

# 5. Verify port 8000 is free
$remainingNetstat = netstat -ano | Select-String ":8000\s+.*LISTENING"
if ($remainingNetstat) {
    Write-Warning "Port 8000 is still listening: $remainingNetstat"
    exit 1
} else {
    if ($stoppedAny) {
        Write-Host "[OK] RouteX backend stopped successfully. Port 8000 is now free." -ForegroundColor Green
    } else {
        Write-Host "[OK] No active RouteX backend was listening on port 8000." -ForegroundColor Green
    }
    exit 0
}
