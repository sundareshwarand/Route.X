# RouteX — Beginner-Friendly Local Gemini API Key Setup Helper
# Securely sets up your Google Gemini API key in backend\.env without exposing secrets.

[CmdletBinding()]
param(
    [switch]$NonInteractive,
    [string]$ApiKey = ""
)

$ErrorActionPreference = "Stop"

Clear-Host
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "         RouteX -- Google Gemini AI Local Setup Helper          " -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "This helper securely configures Google Gemini AI advisory"
Write-Host "for RouteX without exposing your key or storing it in the browser."
Write-Host ""

# 1. Resolve project root and backend .env path
$projectRoot = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path "$projectRoot\backend\app\main.py")) {
    $projectRoot = "C:\Users\Sundareshwaran\Desktop\Route.X"
}

$backendDir = Join-Path $projectRoot "backend"
$envFile    = Join-Path $backendDir ".env"
$exampleEnv = Join-Path $backendDir ".env.example"

Write-Host "[1/5] Checking configuration files..." -ForegroundColor Yellow
Write-Host ("      Project Root: " + $projectRoot)
Write-Host ("      Backend .env: " + $envFile)

# 2. Ensure backend\.env exists
if (-not (Test-Path $envFile)) {
    if (Test-Path $exampleEnv) {
        Write-Host "      '.env' not found. Creating from '.env.example'..." -ForegroundColor Cyan
        Copy-Item -Path $exampleEnv -Destination $envFile -Force
    } else {
        Write-Host "      Creating fresh '.env' file..." -ForegroundColor Cyan
        $initialContent = @(
            'GEMINI_API_KEY=""',
            'GEMINI_MODEL="gemini-2.5-flash"'
        )
        Set-Content -Path $envFile -Value $initialContent -Encoding UTF8
    }
} else {
    Write-Host "      Existing '.env' found. Preserving all existing settings." -ForegroundColor Green
}

# 3. Check Git Ignore status for security
Write-Host ""
Write-Host "[2/5] Verifying secret hygiene..." -ForegroundColor Yellow
$rootGitIgnore = Join-Path $projectRoot ".gitignore"
$backendGitIgnore = Join-Path $backendDir ".gitignore"

$gitIgnored = $false
if (Test-Path $backendGitIgnore) {
    $content = Get-Content $backendGitIgnore -Raw
    if ($content -match '(^|\r?\n)\s*\.env(\s|$)') {
        $gitIgnored = $true
    }
}
if ((-not $gitIgnored) -and (Test-Path $rootGitIgnore)) {
    $content = Get-Content $rootGitIgnore -Raw
    if ($content -match '(^|\r?\n)\s*\.env(\s|$)') {
        $gitIgnored = $true
    }
}

if ($gitIgnored) {
    Write-Host "      [OK] .env is properly excluded from Git version control." -ForegroundColor Green
} else {
    Write-Host "      [NOTICE] Appending '.env' to .gitignore for safety." -ForegroundColor Yellow
    Add-Content -Path $backendGitIgnore -Value "`r`n.env`r`n.env.*" -Encoding UTF8
}

# 4. Acquire Gemini API Key securely
Write-Host ""
Write-Host "[3/5] Gemini API Key Configuration" -ForegroundColor Yellow
Write-Host "      Need a Gemini API key?" -ForegroundColor Cyan
Write-Host "      1. Visit: https://aistudio.google.com/apikey" -ForegroundColor White
Write-Host "      2. Click 'Create API key' in Google AI Studio." -ForegroundColor White
Write-Host "      3. Copy your key." -ForegroundColor White
Write-Host ""

$rawKey = ""

if ($ApiKey -ne "") {
    $rawKey = $ApiKey.Trim()
} else {
    Write-Host "Enter your Gemini API key below (characters will be hidden):" -ForegroundColor Cyan
    $secureInput = Read-Host -Prompt "Gemini API Key" -AsSecureString
    if ($null -ne $secureInput) {
        $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureInput)
        try {
            $rawKey = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
        } finally {
            [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
        }
    }
}

$rawKey = $rawKey.Trim().Trim('"').Trim("'")

# Validate key input
$isPlaceholder = ($rawKey -match '^(YOUR_|your_key|replace-|placeholder|<|dummy)' -or $rawKey -like '*ENTERED_LOCALLY*')

if ([string]::IsNullOrWhiteSpace($rawKey)) {
    Write-Host ""
    Write-Host "[ERROR] Key input was empty. Configuration was not modified." -ForegroundColor Red
    Write-Host "        Deterministic Rule-Based fallback will remain active." -ForegroundColor Yellow
    exit 1
} elseif ($isPlaceholder) {
    Write-Host ""
    Write-Host ("[ERROR] Input appears to be an instructional placeholder: " + $rawKey) -ForegroundColor Red
    Write-Host "        Please obtain a real key from https://aistudio.google.com/apikey" -ForegroundColor Yellow
    exit 1
} elseif ($rawKey.Length -lt 10) {
    Write-Host ""
    Write-Host ("[ERROR] Key appears too short (" + $rawKey.Length + " characters). Please check your key.") -ForegroundColor Red
    exit 1
}

# 5. Update backend\.env cleanly preserving other settings
Write-Host ""
Write-Host "[4/5] Updating backend\.env..." -ForegroundColor Yellow

$lines = Get-Content $envFile
$newLines = @()
$foundKey = $false
$foundModel = $false

foreach ($line in $lines) {
    if ($line -match '^\s*GEMINI_API_KEY\s*=') {
        $newLines += ('GEMINI_API_KEY="' + $rawKey + '"')
        $foundKey = $true
    } elseif ($line -match '^\s*GEMINI_MODEL\s*=') {
        $newLines += $line
        $foundModel = $true
    } else {
        $newLines += $line
    }
}

if (-not $foundKey) {
    $newLines += ('GEMINI_API_KEY="' + $rawKey + '"')
}
if (-not $foundModel) {
    $newLines += 'GEMINI_MODEL="gemini-2.5-flash"'
}

Set-Content -Path $envFile -Value $newLines -Encoding UTF8
Write-Host "      [OK] GEMINI_API_KEY updated successfully in backend\.env." -ForegroundColor Green
Write-Host ("      [OK] Key Length: " + $rawKey.Length + " characters. Value is hidden and protected.") -ForegroundColor Green

# 6. Offer immediate backend restart
Write-Host ""
Write-Host "[5/5] Backend Service Restart" -ForegroundColor Yellow
$manageScript = Join-Path $PSScriptRoot "manage_routex_backend.ps1"

$shouldRestart = $true
if (-not $NonInteractive) {
    $choice = Read-Host "Restart RouteX backend now to apply changes? (Y/n)"
    if ($choice.Trim() -eq "n" -or $choice.Trim() -eq "N") {
        $shouldRestart = $false
    }
}

if ($shouldRestart -and (Test-Path $manageScript)) {
    Write-Host "      Restarting RouteX backend service..." -ForegroundColor Cyan
    & $manageScript -Action restart
    
    Start-Sleep -Seconds 2
    Write-Host ""
    Write-Host "Verifying new AI service status..." -ForegroundColor Yellow
    try {
        $statusResp = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/ai/status" -Method Get -TimeoutSec 3
        Write-Host ("      Provider  : " + $statusResp.provider) -ForegroundColor White
        Write-Host ("      Model     : " + $statusResp.model) -ForegroundColor White
        Write-Host ("      Status    : " + $statusResp.status_label) -ForegroundColor Green
        Write-Host ("      Configured: " + $statusResp.is_configured) -ForegroundColor Green
    } catch {
        Write-Host "      Backend did not respond immediately. Check status with: manage_routex_backend.ps1 -Action status" -ForegroundColor Yellow
    }
} else {
    Write-Host "      Skipping automatic restart." -ForegroundColor Yellow
    Write-Host "      Run this command when ready to apply changes:" -ForegroundColor White
    Write-Host ("      powershell -ExecutionPolicy Bypass -File `"" + $manageScript + "`" -Action restart") -ForegroundColor Cyan
}

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host " Setup complete! RouteX AI Advisory module is configured. " -ForegroundColor Green
Write-Host "================================================================" -ForegroundColor Cyan
