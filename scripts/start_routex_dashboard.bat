@echo off
set "SCRIPT_DIR=%~dp0"
set "DASHBOARD_DIR=%SCRIPT_DIR%..\dashboard"
cd /d "%DASHBOARD_DIR%"
echo ========================================================
echo       RouteX Operations Command Dashboard Launcher       
echo ========================================================
echo Starting Vite dev server on http://localhost:5173 ...
npm run dev
