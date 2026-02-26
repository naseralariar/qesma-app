param(
    [string]$AdminUsername = "admin",
    [SecureString]$AdminPassword,
    [string]$DepartmentCode = "EXE-01",
    [int]$Port = 8000,
    [string]$OutputPath = "./artifacts/verification-report.json",
    [string]$UploadEndpoint = "",
    [string]$BearerToken = "",
    [string]$ApiKey = "",
    [string]$ApiKeyHeader = "x-api-key",
    [int]$UploadTimeoutSec = 30
)

$ErrorActionPreference = "Stop"

if (-not $AdminPassword) {
    if (-not [string]::IsNullOrWhiteSpace($env:QESMA_ADMIN_PASSWORD)) {
        $AdminPassword = ConvertTo-SecureString $env:QESMA_ADMIN_PASSWORD -AsPlainText -Force
    }
    else {
        $AdminPassword = Read-Host "Enter admin password" -AsSecureString
    }
}

$projectRoot = Split-Path -Parent $PSScriptRoot
$verifyScript = Join-Path $PSScriptRoot "verify-local-report.ps1"

if (-not (Test-Path $verifyScript)) {
    throw "Required script missing: $verifyScript"
}

Write-Host "[1/2] Running local verification with JSON report..." -ForegroundColor Cyan
& $verifyScript -AdminUsername $AdminUsername -AdminPassword $AdminPassword -DepartmentCode $DepartmentCode -Port $Port -OutputPath $OutputPath
if ($LASTEXITCODE -ne 0) {
    throw "Local verification failed. Upload is skipped."
}

$resolvedOutput = Join-Path $projectRoot $OutputPath
if (-not (Test-Path $resolvedOutput)) {
    throw "Report file not found: $resolvedOutput"
}

if ([string]::IsNullOrWhiteSpace($UploadEndpoint)) {
    Write-Host "[2/2] Upload endpoint not provided. Report generated only: $resolvedOutput" -ForegroundColor Yellow
    exit 0
}

Write-Host "[2/2] Uploading report to endpoint..." -ForegroundColor Cyan
$headers = @{}
if (-not [string]::IsNullOrWhiteSpace($BearerToken)) {
    $headers["Authorization"] = "Bearer $BearerToken"
}
if (-not [string]::IsNullOrWhiteSpace($ApiKey)) {
    $headers[$ApiKeyHeader] = $ApiKey
}

$reportContent = Get-Content -Path $resolvedOutput -Raw -Encoding UTF8

Invoke-RestMethod -Method Post -Uri $UploadEndpoint -Headers $headers -ContentType "application/json" -Body $reportContent -TimeoutSec $UploadTimeoutSec | Out-Null
Write-Host "Report uploaded successfully to: $UploadEndpoint" -ForegroundColor Green
