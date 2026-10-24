# RouteX — User Startup Folder Installer
# Automatically starts RouteX backend on Windows sign-in with ZERO terminal windows (No Admin privileges required).

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path "$projectRoot\backend\app\main.py")) {
    $projectRoot = "C:\Users\Sundareshwaran\Desktop\Route.X"
}

$startScript = Join-Path $projectRoot "scripts\start_routex_backend.ps1"
$startupDir  = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Startup)
$vbsPath     = Join-Path $startupDir "RouteX_AutoStart.vbs"

$vbsContent = @"
' RouteX Background Auto-Start Launcher
' Runs powershell start script hidden without any console window or popup.
Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "powershell.exe -WindowStyle Hidden -ExecutionPolicy Bypass -File ""$startScript""", 0, False
"@

Set-Content -Path $vbsPath -Value $vbsContent -Encoding ASCII -Force

Write-Host "[SUCCESS] RouteX AutoStart installed to Windows Startup folder!" -ForegroundColor Green
Write-Host "  File Location: $vbsPath"
Write-Host "  Target Script: $startScript"
Write-Host ""
Write-Host "The backend will now launch automatically in the background whenever Windows starts,"
Write-Host "without needing to open VS Code, PowerShell, or any terminal window."
