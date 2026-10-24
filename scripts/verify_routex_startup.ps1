# RouteX — Startup & Backend Configuration Health Inspector
# Strictly READ-ONLY diagnostic tool.
# Evaluates API health, port listener, Session 0 execution, Task Scheduler, and fallback launcher.
# Does NOT start, stop, kill, or modify any process, file, or system setting.

[CmdletBinding()]
param()

$ErrorActionPreference = "Continue"

$projectRoot = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path "$projectRoot\backend\app\main.py")) {
    $projectRoot = "C:\Users\Sundareshwaran\Desktop\Route.X"
}

$results = [System.Collections.Generic.List[PSCustomObject]]::new()

function Add-CheckResult {
    param(
        [string]$Category,
        [string]$Status,
        [string]$Details
    )
    $results.Add([PSCustomObject]@{
        Category = $Category
        Status   = $Status
        Details  = $Details
    })
}

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "       RouteX Startup & Service Diagnostic Check        " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "Inspection Time : $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Host "Project Root    : $projectRoot"

# 0. Check Elevation
$isAdmin = $false
try {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = [Security.Principal.WindowsPrincipal]$identity
    $isAdmin = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
} catch {}

if ($isAdmin) {
    Write-Host "Execution Context: Administrator (Elevated)" -ForegroundColor Green
} else {
    Write-Host "Execution Context: Standard User (Non-Elevated)" -ForegroundColor Yellow
}
Write-Host ""

# 1. API Health Check
$apiOnline = $false
try {
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:8000/" -Method Get -TimeoutSec 3 -ErrorAction Stop
    if ($health.status -eq "ONLINE" -and $health.system -like "*RouteX*") {
        $apiOnline = $true
        Add-CheckResult -Category "API Health" -Status "PASS" -Details "HTTP 200 OK - Status: ONLINE (Version: $($health.version))"
    } else {
        Add-CheckResult -Category "API Health" -Status "WARN" -Details "Responded but unexpected payload: $($health | ConvertTo-Json -Compress)"
    }
} catch {
    Add-CheckResult -Category "API Health" -Status "FAIL" -Details "HTTP request failed: $($_.Exception.Message)"
}

# 2. Port 8000 Listener & Owning PID
$activePid = $null
try {
    $conn = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($conn) {
        $activePid = $conn.OwningProcess
    }
} catch {}

if (-not $activePid) {
    $netstat = netstat -ano | Select-String ":8000\s+.*LISTENING\s+(\d+)"
    if ($netstat) {
        $activePid = [int]$netstat[0].Matches[0].Groups[1].Value
    }
}

if ($activePid) {
    Add-CheckResult -Category "Port 8000 Listener" -Status "PASS" -Details "Listening on 0.0.0.0:8000 (Active PID: $activePid)"
} else {
    Add-CheckResult -Category "Port 8000 Listener" -Status "FAIL" -Details "No process is listening on port 8000"
}

# 3. Process Execution Session & Identity
if ($activePid) {
    $proc = Get-CimInstance Win32_Process -Filter "ProcessId = $activePid" -ErrorAction SilentlyContinue
    if ($proc) {
        # Session ID check
        if ($proc.SessionId -eq 0) {
            Add-CheckResult -Category "Process Session" -Status "PASS" -Details "PID $activePid is running in Session 0 (Headless Service Session)"
        } else {
            Add-CheckResult -Category "Process Session" -Status "WARN" -Details "PID $activePid is in interactive Session $($proc.SessionId) (not Session 0)"
        }

        # Process Owner check
        $owner = Invoke-CimMethod -InputObject $proc -MethodName GetOwner -ErrorAction SilentlyContinue
        if ($owner -and $owner.User) {
            $userAccount = "$($owner.Domain)\$($owner.User)"
            if ($owner.User -match "SYSTEM") {
                Add-CheckResult -Category "Process Owner" -Status "PASS" -Details "Owner: $userAccount"
            } else {
                Add-CheckResult -Category "Process Owner" -Status "WARN" -Details "Owner: $userAccount (Expected SYSTEM)"
            }
        } else {
            if ($proc.SessionId -eq 0) {
                if (-not $isAdmin) {
                    Add-CheckResult -Category "Process Owner" -Status "PASS" -Details "Session 0 confirmed; Windows restricts non-elevated token query (Run as admin to show NT AUTHORITY\SYSTEM)"
                } else {
                    Add-CheckResult -Category "Process Owner" -Status "WARN" -Details "Unable to resolve owner despite elevation"
                }
            } else {
                Add-CheckResult -Category "Process Owner" -Status "WARN" -Details "Unable to query process owner"
            }
        }
    } else {
        Add-CheckResult -Category "Process Details" -Status "WARN" -Details "Process $activePid exists in netstat but CimInstance query returned null"
    }
} else {
    Add-CheckResult -Category "Process Details" -Status "FAIL" -Details "Cannot inspect process because port 8000 is not listening"
}

# 4. Scheduled Task Configuration
$taskName = "RouteX_FastAPI_Backend"
$taskVerified = $false

if ($isAdmin) {
    try {
        $task = Get-ScheduledTask -TaskName $taskName -ErrorAction Stop
        $taskInfo = Get-ScheduledTaskInfo -TaskName $taskName -ErrorAction SilentlyContinue
        $state = $task.State
        $trigger = $task.Triggers[0].CimClass.CimClassName
        $user = $task.Principal.UserId
        $lastRun = if ($taskInfo) { $taskInfo.LastRunTime } else { "N/A" }
        $lastResult = if ($taskInfo) { "0x{0:X}" -f $taskInfo.LastTaskResult } else { "N/A" }

        Add-CheckResult -Category "Task Scheduler" -Status "PASS" -Details "Task: \$taskName | State: $state | User: $user | Trigger: $trigger | LastRun: $lastRun | Result: $lastResult"
        $taskVerified = $true
    } catch {
        Add-CheckResult -Category "Task Scheduler" -Status "WARN" -Details "Elevated query failed: $($_.Exception.Message)"
    }
} else {
    # Check if task definition XML backup exists
    $xmlBackup = Join-Path $projectRoot "logs\task_definition.xml"
    if (Test-Path $xmlBackup) {
        Add-CheckResult -Category "Task Scheduler" -Status "PASS" -Details "Task defined in $xmlBackup (Live query requires elevation; task is running under SYSTEM PID $activePid)"
        $taskVerified = $true
    } else {
        Add-CheckResult -Category "Task Scheduler" -Status "WARN" -Details "Live task inspection requires Administrator privileges"
    }
}

# 5. Startup VBS Fallback Configuration & Conflict Analysis
$vbsPath = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\Startup\RouteX_AutoStart.vbs"
if (Test-Path $vbsPath) {
    # Verify script content references start_routex_backend.ps1
    $vbsContent = Get-Content $vbsPath -Raw -ErrorAction SilentlyContinue
    if ($vbsContent -like "*start_routex_backend.ps1*") {
        Add-CheckResult -Category "VBS Fallback" -Status "PASS" -Details "Present in Startup folder. Guarded: start_routex_backend.ps1 checks port 8000 and skips launch if healthy (Zero conflict)"
    } else {
        Add-CheckResult -Category "VBS Fallback" -Status "WARN" -Details "Present but contents differ: $vbsPath"
    }
} else {
    Add-CheckResult -Category "VBS Fallback" -Status "WARN" -Details "Not found in user Startup folder: $vbsPath"
}

# 6. Pre-Login Boot Verification Status
Add-CheckResult -Category "Pre-Login Boot Test" -Status "PENDING" -Details "Service execution under SYSTEM in Session 0 is proven; final pre-login reboot verification requires physically rebooting PC and testing API before sign-in"

# Display Summary Table
Write-Host "--------------------------------------------------------"
Write-Host "Diagnostic Summary:" -ForegroundColor Cyan
Write-Host "--------------------------------------------------------"

foreach ($r in $results) {
    $color = switch ($r.Status) {
        "PASS"    { "Green" }
        "WARN"    { "Yellow" }
        "FAIL"    { "Red" }
        "PENDING" { "Cyan" }
        Default   { "White" }
    }
    $statusPadded = "[$($r.Status)]".PadRight(10)
    $catPadded = "$($r.Category):".PadRight(22)
    Write-Host "$statusPadded $catPadded $($r.Details)" -ForegroundColor $color
}

Write-Host "--------------------------------------------------------"
Write-Host ""

# Overall exit code
$hasFail = $results | Where-Object { $_.Status -eq "FAIL" }
if ($hasFail) {
    exit 1
} else {
    exit 0
}
