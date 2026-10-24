# RouteX — Pre-flight Verification Script
# Confirms that the listener on port 8000 is genuinely the RouteX backend before any handoff.

$ErrorActionPreference = "Stop"

try {
    $h = Invoke-RestMethod -Uri "http://127.0.0.1:8000/" -TimeoutSec 2
    if ($h.system -like "*RouteX*" -and $h.status -eq "ONLINE") {
        Write-Host "  [OK] Verified RouteX backend is currently online on port 8000." -ForegroundColor Green
        exit 0
    } else {
        Write-Host "  [ERROR] Port 8000 responded, but is not RouteX!" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "  [INFO] Port 8000 is not currently responding to HTTP. Checking socket..." -ForegroundColor Yellow
    $conn = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue
    if ($conn) {
        Write-Host "  [ERROR] Port 8000 is listening by PID $($conn.OwningProcess) but not responding as RouteX!" -ForegroundColor Red
        exit 1
    }
    Write-Host "  [OK] Port 8000 is free." -ForegroundColor Green
    exit 0
}
