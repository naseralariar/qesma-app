param(
    [string]$AdminUsername = "admin",
    [string]$AdminPassword = "ChangeMe@123",
    [string]$DepartmentCode = "EXE-01",
    [int]$Port = 8000
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$backendPath = Join-Path $projectRoot "backend"
$pythonExe = Join-Path $projectRoot ".venv\Scripts\python.exe"

if (-not (Test-Path $pythonExe)) {
    throw "Python venv interpreter not found at: $pythonExe"
}

Push-Location $backendPath
try {
    $env:DB_ENGINE = "sqlite"

    Write-Host "[1/6] Making migrations..." -ForegroundColor Cyan
    & $pythonExe manage.py makemigrations accounts core distributions reports | Out-Host

    Write-Host "[2/6] Applying migrations..." -ForegroundColor Cyan
    & $pythonExe manage.py migrate | Out-Host

    Write-Host "[3/6] Bootstrapping departments + admin..." -ForegroundColor Cyan
    & $pythonExe manage.py bootstrap_system --username $AdminUsername --password $AdminPassword --department-code $DepartmentCode | Out-Host

    Write-Host "[4/6] Starting backend server..." -ForegroundColor Cyan
    $serverProcess = Start-Process -FilePath $pythonExe -ArgumentList "manage.py runserver 127.0.0.1:$Port" -WorkingDirectory $backendPath -PassThru -WindowStyle Hidden

    Start-Sleep -Seconds 3

    Write-Host "[5/6] Verifying JWT login..." -ForegroundColor Cyan
    $loginBody = @{ username = $AdminUsername; password = $AdminPassword } | ConvertTo-Json
    $tokenResponse = Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:$Port/api/auth/token/" -ContentType "application/json" -Body $loginBody

    if (-not $tokenResponse.access) {
        throw "Login verification failed: access token missing."
    }

    $headers = @{ Authorization = "Bearer $($tokenResponse.access)" }
    $me = Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:$Port/api/auth/me/" -Headers $headers

    if ($me.username -ne $AdminUsername) {
        throw "Profile verification failed: username mismatch."
    }

    Write-Host "[6/6] Verification succeeded: ME_OK:$($me.username):$($me.role)" -ForegroundColor Green
}
finally {
    if ($serverProcess -and -not $serverProcess.HasExited) {
        Stop-Process -Id $serverProcess.Id -Force
        Write-Host "Backend server stopped." -ForegroundColor Yellow
    }
    Pop-Location
}
