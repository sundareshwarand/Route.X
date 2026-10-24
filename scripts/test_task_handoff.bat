@echo off
setlocal EnableDelayedExpansion
title RouteX Task Handoff and Fallback Tester

set "SCRIPT_DIR=%~dp0"
set "PROJECT_ROOT=%SCRIPT_DIR%.."
cd /d "%PROJECT_ROOT%"

echo ========================================================
echo       RouteX Scheduled Task Safe Handoff Test           
echo ========================================================
echo.

rem 1. Check Administrator privileges
net session >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] This test requires Administrator privileges to trigger a SYSTEM task!
    echo Please right-click "test_task_handoff.bat" and select "Run as administrator".
    pause
    exit /b 1
)

rem 2. Confirm current port 8000 listener belongs to RouteX before touching it
echo [1/5] Verifying that port 8000 listener is genuine RouteX backend...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%verify_routex_preflight.ps1"
if %ERRORLEVEL% NEQ 0 (
    echo [ABORT] Pre-flight check failed! Refusing to terminate an unidentified process.
    pause
    exit /b 1
)

rem 3. Stop manual user backend and wait for port 8000 to be completely free
echo.
echo [2/5] Stopping manual user backend and waiting for port 8000 to be free...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%stop_routex_backend.ps1"
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to stop the current backend process.
    pause
    exit /b 1
)

rem Explicit socket wait loop (up to 5 seconds)
set PORT_FREE=0
for /L %%i in (1,1,5) do (
    netstat -ano | findstr ":8000.*LISTENING" >nul 2>&1
    if !ERRORLEVEL! NEQ 0 (
        set PORT_FREE=1
        goto :PortFreed
    )
    timeout /t 1 /nobreak >nul
)

:PortFreed
if "%PORT_FREE%"=="0" (
    echo [ERROR] Port 8000 could not be freed in 5 seconds. Aborting task launch.
    pause
    exit /b 1
)
echo   [OK] Port 8000 is verified completely free.

rem 4. Trigger scheduled task under SYSTEM
echo.
echo [3/5] Triggering scheduled task RouteX_FastAPI_Backend under SYSTEM...
schtasks.exe /Run /TN "RouteX_FastAPI_Backend"
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to invoke schtasks.exe /Run.
    goto :DoFallback
)

rem 5. Wait up to 10 seconds for Task Scheduler backend to become healthy
echo.
echo [4/5] Waiting up to 10 seconds for Task Scheduler backend to respond ONLINE...
set TASK_HEALTHY=0
for /L %%i in (1,1,10) do (
    timeout /t 1 /nobreak >nul
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%test_routex_health.ps1"
    if !ERRORLEVEL! EQU 0 (
        set TASK_HEALTHY=1
        goto :TaskSuccess
    )
    echo   ... waiting [%%i/10s]
)

goto :DoFallback

:TaskSuccess
echo.
echo ========================================================
echo  [SUCCESS] Task Scheduler backend is ONLINE and healthy!
echo ========================================================
echo.
echo [5/5] Verifying process details - Owner should be SYSTEM in Session 0:
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%inspect_process.ps1"
goto :Done

:DoFallback
echo.
echo ========================================================
echo  [WARNING] Task Scheduler backend did not respond in 10s!
echo  [FALLBACK] Automatically restoring user-level backend...
echo ========================================================
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%start_routex_backend.ps1"

rem Verify fallback recovery
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%test_routex_health.ps1"
if %ERRORLEVEL% EQU 0 (
    echo   [RECOVERY OK] User-level backend restored successfully!
    echo [OK] User-level backend is operational. Diagnostic logs:
    echo --- Last 10 lines of stderr.log ---
    if exist logs\routex_backend_stderr.log powershell.exe -NoProfile -Command "Get-Content logs\routex_backend_stderr.log -Tail 10"
) else (
    echo [CRITICAL ERROR] Both Task Scheduler and manual fallback failed to start!
    echo --- Last 15 lines of stderr.log ---
    if exist logs\routex_backend_stderr.log powershell.exe -NoProfile -Command "Get-Content logs\routex_backend_stderr.log -Tail 15"
)

:Done
echo.
echo ========================================================
pause
