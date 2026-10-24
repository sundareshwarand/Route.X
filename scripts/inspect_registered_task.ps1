# RouteX Task Scheduler Direct Verification
$ErrorActionPreference = "Continue"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "        RouteX_FastAPI_Backend Task Verification          " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. PowerShell CIM query
try {
    $task = Get-ScheduledTask -TaskName "RouteX_FastAPI_Backend" -ErrorAction Stop
    Write-Host "[OK] Get-ScheduledTask succeeded!" -ForegroundColor Green
    Write-Host "  Task Name   : $($task.TaskName)"
    Write-Host "  State       : $($task.State)"
    Write-Host "  Description : $($task.Description)"
    Write-Host ""
    Write-Host "[PRINCIPAL]" -ForegroundColor Yellow
    Write-Host "  UserId      : $($task.Principal.UserId)"
    Write-Host "  LogonType   : $($task.Principal.LogonType)"
    Write-Host "  RunLevel    : $($task.Principal.RunLevel)"
    Write-Host ""
    Write-Host "[TRIGGER]" -ForegroundColor Yellow
    foreach ($trig in $task.Triggers) {
        Write-Host "  Trigger Type: $($trig.CimClass.CimClassName) (Boot/AtStartup)"
        Write-Host "  Enabled     : $($trig.Enabled)"
    }
    Write-Host ""
    Write-Host "[ACTION]" -ForegroundColor Yellow
    foreach ($act in $task.Actions) {
        Write-Host "  Execute     : $($act.Execute)"
        Write-Host "  Arguments   : $($act.Arguments)"
        Write-Host "  Working Dir : $($act.WorkingDirectory)"
    }
    Write-Host ""
    Write-Host "[SETTINGS]" -ForegroundColor Yellow
    Write-Host "  RestartCount            : $($task.Settings.RestartCount)"
    Write-Host "  RestartInterval         : $($task.Settings.RestartInterval)"
    Write-Host "  MultipleInstances       : $($task.Settings.MultipleInstances)"
    Write-Host "  ExecutionTimeLimit      : $($task.Settings.ExecutionTimeLimit)"
    Write-Host "  DisallowStartIfOnBatteries: $($task.Settings.DisallowStartIfOnBatteries)"
    Write-Host "  StopIfGoingOnBatteries  : $($task.Settings.StopIfGoingOnBatteries)"
} catch {
    Write-Host "[FAIL] Get-ScheduledTask failed: $($_.Exception.Message)" -ForegroundColor Red
}

# 2. Get-ScheduledTaskInfo
Write-Host ""
Write-Host "[SCHEDULED TASK INFO]" -ForegroundColor Yellow
try {
    $info = Get-ScheduledTaskInfo -TaskName "RouteX_FastAPI_Backend" -ErrorAction Stop
    Write-Host "  LastRunTime  : $($info.LastRunTime)"
    Write-Host "  NextRunTime  : $($info.NextRunTime)"
    Write-Host "  NumberOfMissedRuns : $($info.NumberOfMissedRuns)"
    Write-Host "  LastTaskResult     : 0x$($info.LastTaskResult.ToString('X'))"
} catch {
    Write-Host "  Failed to query Get-ScheduledTaskInfo: $($_.Exception.Message)" -ForegroundColor Red
}

# 3. schtasks.exe query
Write-Host ""
Write-Host "[SCHTASKS.EXE QUERY]" -ForegroundColor Yellow
schtasks.exe /query /TN "RouteX_FastAPI_Backend" /fo LIST 2>&1
