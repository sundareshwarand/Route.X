# RouteX — Inspect Process Details
# Inspects the process listening on port 8000 or recorded in routex_backend.pid.

$ErrorActionPreference = "Continue"

$projectRoot = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path "$projectRoot\backend\app\main.py")) {
    $projectRoot = "C:\Users\Sundareshwaran\Desktop\Route.X"
}

# 1. Detect listener on port 8000
$conn = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
$procId = $null
if ($conn) {
    $procId = $conn.OwningProcess
} else {
    $pidFile = Join-Path $projectRoot "logs\routex_backend.pid"
    if (Test-Path $pidFile) {
        $saved = (Get-Content $pidFile -ErrorAction SilentlyContinue | Out-String).Trim()
        if ($saved -match '^\d+$') {
            $procId = [int]$saved
        }
    }
}

if (-not $procId) {
    Write-Host "No active RouteX process detected on port 8000." -ForegroundColor Yellow
    exit 0
}

$p = Get-CimInstance Win32_Process -Filter "ProcessId = $procId" -ErrorAction SilentlyContinue
if ($p) {
    Write-Host "Process ID:        $($p.ProcessId)"
    Write-Host "Process Name:      $($p.Name)"
    Write-Host "Executable Path:   $($p.ExecutablePath)"
    Write-Host "Session ID:        $($p.SessionId)"
    Write-Host "Creation Date:     $($p.CreationDate)"
    Write-Host "Command Line:      $($p.CommandLine)"
    Write-Host "Parent Process ID: $($p.ParentProcessId)"

    $parent = Get-CimInstance Win32_Process -Filter "ProcessId = $($p.ParentProcessId)" -ErrorAction SilentlyContinue
    if ($parent) {
        Write-Host "Parent Name:       $($parent.Name)"
        Write-Host "Parent CmdLine:    $($parent.CommandLine)"
    }

    $owner = Invoke-CimMethod -InputObject $p -MethodName GetOwner -ErrorAction SilentlyContinue
    if ($owner) {
        Write-Host "Owner User:        $($owner.User)"
        Write-Host "Owner Domain:      $($owner.Domain)"
    }
} else {
    Write-Host "Process $procId is not running."
}
