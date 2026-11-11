[CmdletBinding()]
param(
    [ValidateSet("pi", "fake")]
    [string]$Runtime = "pi",

    [ValidateSet("synthetic", "tia-readonly")]
    [string]$EngineeringMode = "synthetic",

    [int]$Port = 4310,

    [switch]$SkipBuild,

    [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw "Node.js is required but was not found on PATH."
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw "npm is required but was not found on PATH."
}

if (-not (Test-Path -LiteralPath "$Root/node_modules" -PathType Container)) {
    throw "Dependencies are not installed. Run 'npm install' in $Root first."
}

if (-not $SkipBuild) {
    Write-Host "Building Simon..." -ForegroundColor Cyan
    & npm run build
    if ($LASTEXITCODE -ne 0) { throw "Simon build failed." }
}

$env:SIMON_RUNTIME = $Runtime
$env:SIMON_ENGINEERING_MODE = $EngineeringMode
$env:SIMON_PORT = "$Port"
$env:SIMON_HOST = "127.0.0.1"
$env:SIMON_DATA_DIR = "$Root/data"
$url = "http://127.0.0.1:$Port"

if (-not $NoBrowser) {
    $escapedUrl = $url.Replace("'", "''")
    Start-Process powershell.exe -WindowStyle Hidden -ArgumentList @(
        "-NoProfile",
        "-Command",
        "Start-Sleep -Seconds 2; Start-Process '$escapedUrl'"
    ) | Out-Null
}

Write-Host "Starting Simon at $url" -ForegroundColor Green
Write-Host "Runtime: $Runtime" -ForegroundColor DarkGray
Write-Host "Engineering mode: $EngineeringMode" -ForegroundColor DarkGray
Write-Host "Press Ctrl+C to stop." -ForegroundColor DarkGray

& npm run start --workspace @simon/server
exit $LASTEXITCODE
