$ProjectRoot = $PSScriptRoot
$AllowedRoot = "C:\Users\aiagent\UsersShared\Projects\"
$AiUser = "$env:COMPUTERNAME\aiagent"
$Owner = "$env:COMPUTERNAME\byczy"

$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
$isAdmin = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "ERROR: Run this script as Administrator." -ForegroundColor Red
    pause
    exit 1
}

$resolvedProjectRoot = (Resolve-Path $ProjectRoot).Path
$resolvedAllowedRoot = (Resolve-Path $AllowedRoot).Path

if (-not $resolvedProjectRoot.StartsWith($resolvedAllowedRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    Write-Host "ERROR: This script is outside the allowed AI root." -ForegroundColor Red
    Write-Host "ProjectRoot: $resolvedProjectRoot"
    Write-Host "AllowedRoot: $resolvedAllowedRoot"
    pause
    exit 1
}

$secretEnvNames = @(
    ".env",
    ".env.local",
    ".env.production",
    ".env.development",
    ".env.test",
    ".env.staging"
)

$ignoredDirs = @(
    "\.git\",
    "\node_modules\",
    "\dist\",
    "\build\",
    "\.next\",
    "\coverage\"
)

$envFiles = Get-ChildItem $resolvedProjectRoot -Recurse -Force -File -ErrorAction SilentlyContinue |
    Where-Object {
        $file = $_
        $isSecretEnv = $secretEnvNames -contains $file.Name

        $isIgnored = $false
        foreach ($dir in $ignoredDirs) {
            if ($file.FullName -like "*$dir*") {
                $isIgnored = $true
                break
            }
        }

        $isSecretEnv -and -not $isIgnored
    }

if (-not $envFiles) {
    Write-Host "No secret .env files found in:" -ForegroundColor Yellow
    Write-Host "  $resolvedProjectRoot"
    pause
    exit 0
}

foreach ($file in $envFiles) {
    Write-Host "Protecting:"
    Write-Host "  $($file.FullName)"

    icacls $file.FullName /grant "$($Owner):F" | Out-Null
    icacls $file.FullName /remove:d "$AiUser" | Out-Null
    icacls $file.FullName /deny "$($AiUser):F" | Out-Null
}

Write-Host ""
Write-Host "Done." -ForegroundColor Green
Write-Host "Protected files:"
$envFiles | ForEach-Object { Write-Host "  $($_.FullName)" }

Write-Host ""
Write-Host "Test as aiagent:"
Write-Host "  Get-Content `"$resolvedProjectRoot\.env`""

pause