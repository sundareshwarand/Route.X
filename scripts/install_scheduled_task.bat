@echo off
setlocal EnableDelayedExpansion
title RouteX System Startup Task Installer

echo ========================================================
echo    Registering RouteX System Startup Scheduled Task     
echo ========================================================
echo.

cd /d "%~dp0.."
set LOG_FILE=logs\install_task.log
if not exist logs mkdir logs

echo [*] Starting task installer at %DATE% %TIME% > "%LOG_FILE%"

:: Check for Administrator elevation
net session >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] This installer MUST be run as Administrator!
    echo.
    echo Please right-click "install_scheduled_task.bat" and select:
    echo     "Run as administrator"
    echo.
    echo [ERROR] Administrator privileges not detected. >> "%LOG_FILE%"
    pause
    exit /b 1
)

echo [OK] Running with verified Administrator privileges.
echo [OK] Administrator privileges confirmed. >> "%LOG_FILE%"
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install_scheduled_task.ps1" -TriggerType AtStartup
set PS_EXIT_CODE=%ERRORLEVEL%

echo.
if %PS_EXIT_CODE% EQU 0 (
    echo [SUCCESS] Task installation completed successfully!
    echo [SUCCESS] Task installation completed successfully. >> "%LOG_FILE%"
) else (
    echo [ERROR] Task installation exited with error code %PS_EXIT_CODE%!
    echo [ERROR] Task installation exited with error code %PS_EXIT_CODE%. >> "%LOG_FILE%"
)

echo.
echo ========================================================
pause
