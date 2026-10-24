@echo off
title RouteX Task Definition Exporter
cd /d "%~dp0.."

echo ========================================================
echo       Exporting RouteX_FastAPI_Backend Task Info         
echo ========================================================
echo.

set LOG_DIR=logs
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

echo [*] Exporting Task Scheduler XML to logs\task_definition.xml (Zero ACL modifications)...
schtasks.exe /query /TN "RouteX_FastAPI_Backend" /XML > "%LOG_DIR%\task_definition.xml"

echo.
if %ERRORLEVEL% EQU 0 (
    echo [SUCCESS] Task XML exported to logs\task_definition.xml!
) else (
    echo [ERROR] Failed to export task XML (Exit code: %ERRORLEVEL%).
)

echo.
pause
