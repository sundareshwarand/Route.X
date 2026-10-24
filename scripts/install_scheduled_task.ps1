# RouteX — Windows Task Scheduler Installer
# Registers a persistent scheduled task to launch RouteX backend automatically at system startup.
# Note: Windows Task Scheduler registration requires Administrator privileges.

param(
    [ValidateSet("AtStartup", "AtLogOn")]
    [string]$TriggerType = "AtStartup"
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path "$projectRoot\backend\app\main.py")) {
    $projectRoot = "C:\Users\Sundareshwaran\Desktop\Route.X"
}

$taskName     = "RouteX_FastAPI_Backend"
$runnerScript = Join-Path $projectRoot "scripts\run_routex_server.bat"
$backendDir   = Join-Path $projectRoot "backend"
$logFile      = Join-Path $projectRoot "logs\install_task.log"

function Log-Msg {
    param([string]$Message, [string]$Color = "White")
    Write-Host $Message -ForegroundColor $Color
    if (Test-Path (Split-Path $logFile -Parent)) {
        Add-Content -Path $logFile -Value $Message -Force -ErrorAction SilentlyContinue
    }
}

# Check Administrator privileges
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Log-Msg "[ERROR] Task Scheduler modification requires Administrator privileges." "Red"
    Log-Msg "Please run this script from an elevated prompt or right-click install_scheduled_task.bat and select 'Run as administrator'." "Yellow"
    exit 1
}

Log-Msg "[*] Target Task Name: $taskName" "Cyan"
Log-Msg "[*] Supervised Runner: $runnerScript" "Cyan"
Log-Msg "[*] Backend Working Directory: $backendDir" "Cyan"

# 1. Unregister any existing task (clean idempotent reset)
Log-Msg "[1/3] Removing existing task if present..." "Yellow"
$null = schtasks.exe /Delete /TN $taskName /F 2>&1
Log-Msg "  [OK] Cleaned previous task registration state." "Green"

# 2. Register via schtasks (rock-solid Win32 registration across all Windows builds)
Log-Msg "[2/3] Registering task with AtStartup trigger under SYSTEM..." "Yellow"
$taskRun = "cmd.exe /c `"$runnerScript`""

$createResult = schtasks.exe /Create /TN $taskName /RU "SYSTEM" /SC ONSTART /TR $taskRun /RL HIGHEST /F 2>&1
if ($LASTEXITCODE -ne 0) {
    Log-Msg "[FAIL] schtasks.exe /Create failed with exit code ${LASTEXITCODE}:" "Red"
    Log-Msg "  $createResult" "Red"
    exit 1
}
Log-Msg "  [OK] schtasks: $createResult" "Green"

# 3. Apply advanced settings (restart on crash, battery policy, duplicate policy, working dir) via PowerShell CIM
Log-Msg "[3/3] Configuring restart on failure and execution policies..." "Yellow"
try {
    $task = Get-ScheduledTask -TaskName $taskName -ErrorAction Stop
    $task.Settings.RestartCount = 3
    $task.Settings.RestartInterval = "PT1M"
    $task.Settings.MultipleInstances = "IgnoreNew"
    $task.Settings.DisallowStartIfOnBatteries = $false
    $task.Settings.StopIfGoingOnBatteries = $false
    $task.Settings.ExecutionTimeLimit = "PT0S"
    $task.Author = "RouteX Project"
    $task.Description = "RouteX Intelligent Emergency Traffic Management FastAPI Backend (Persistent Service)"
    
    # Set working directory in action
    if ($task.Actions.Count -gt 0) {
        $task.Actions[0].WorkingDirectory = $backendDir
    }
    
    Set-ScheduledTask -InputObject $task | Out-Null
    Log-Msg "  [OK] Restart-on-failure: 3 retries (1-minute interval)" "Green"
    Log-Msg "  [OK] Multi-instance policy: IgnoreNew" "Green"
    Log-Msg "  [OK] Power policy: Runs on battery and AC power" "Green"
    Log-Msg "  [OK] Working directory: $backendDir" "Green"
} catch {
    Log-Msg "  [WARN] Task created, but advanced settings notice: $($_.Exception.Message)" "Yellow"
}

Log-Msg ""
Log-Msg "========================================================" "Green"
Log-Msg " [SUCCESS] RouteX_FastAPI_Backend is REGISTERED in Windows!" "Green"
Log-Msg "========================================================" "Green"
Log-Msg "  Task Name:    $taskName" "White"
Log-Msg "  Trigger:      At Startup (runs before user logon)" "White"
Log-Msg "  Account:      NT AUTHORITY\SYSTEM" "White"
Log-Msg "  Runner:       $runnerScript" "White"
Log-Msg "  Directory:    $backendDir" "White"
Log-Msg ""
Log-Msg "To test starting the task immediately:" "Cyan"
Log-Msg "  Start-ScheduledTask -TaskName '$taskName'" "Cyan"
exit 0
