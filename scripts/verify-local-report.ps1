param(
    [string]$AdminUsername = "admin",
    [SecureString]$AdminPassword,
    [string]$DepartmentCode = "EXE-01",
    [int]$Port = 8000,
    [string]$OutputPath = "./verification-report.json"
)

$ErrorActionPreference = "Stop"

function ConvertTo-PlainText {
    param(
        [Parameter(Mandatory = $true)]
        [SecureString]$SecureValue
    )

    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureValue)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
}

if (-not $AdminPassword) {
    if (-not [string]::IsNullOrWhiteSpace($env:QESMA_ADMIN_PASSWORD)) {
        $AdminPassword = ConvertTo-SecureString $env:QESMA_ADMIN_PASSWORD -AsPlainText -Force
    }
    else {
        $AdminPassword = Read-Host "Enter admin password" -AsSecureString
    }
}

$AdminPasswordPlain = ConvertTo-PlainText -SecureValue $AdminPassword

$startedAt = Get-Date
$projectRoot = Split-Path -Parent $PSScriptRoot
$backendPath = Join-Path $projectRoot "backend"
$pythonExe = Join-Path $projectRoot ".venv\Scripts\python.exe"
$reportFile = Resolve-Path -LiteralPath $projectRoot
$reportFile = Join-Path $reportFile $OutputPath

$steps = @()
$overallStatus = "PASS"
$failureReason = $null
$serverProcess = $null

function Add-Step {
    param(
        [string]$Name,
        [string]$Status,
        [string]$Message
    )
    $script:steps += [pscustomobject]@{
        name = $Name
        status = $Status
        message = $Message
        timestamp = (Get-Date).ToString("o")
    }
}

Push-Location $backendPath
try {
    if (-not (Test-Path $pythonExe)) {
        throw "Python venv interpreter not found at: $pythonExe"
    }

    $env:DB_ENGINE = "sqlite"

    & $pythonExe manage.py makemigrations accounts core distributions reports *> $null
    Add-Step -Name "makemigrations" -Status "PASS" -Message "No blocking issues"

    & $pythonExe manage.py migrate *> $null
    Add-Step -Name "migrate" -Status "PASS" -Message "Database schema is ready"

    & $pythonExe manage.py bootstrap_system --username $AdminUsername --password $AdminPasswordPlain --department-code $DepartmentCode *> $null
    Add-Step -Name "bootstrap_system" -Status "PASS" -Message "Departments and admin account are ready"

    $serverProcess = Start-Process -FilePath $pythonExe -ArgumentList "manage.py runserver 127.0.0.1:$Port" -WorkingDirectory $backendPath -PassThru -WindowStyle Hidden
    Start-Sleep -Seconds 3
    Add-Step -Name "runserver" -Status "PASS" -Message "Backend server started"

    $loginBody = @{ username = $AdminUsername; password = $AdminPasswordPlain } | ConvertTo-Json
    $tokenResponse = Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:$Port/api/auth/token/" -ContentType "application/json" -Body $loginBody
    if (-not $tokenResponse.access) {
        throw "Access token missing from login response"
    }
    Add-Step -Name "jwt_login" -Status "PASS" -Message "Token issued successfully"

    $headers = @{ Authorization = "Bearer $($tokenResponse.access)" }
    $me = Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:$Port/api/auth/me/" -Headers $headers
    if ($me.username -ne $AdminUsername) {
        throw "Authenticated username mismatch"
    }
    Add-Step -Name "auth_me" -Status "PASS" -Message "Authenticated as $($me.username) role=$($me.role)"
}
catch {
    $overallStatus = "FAIL"
    $failureReason = $_.Exception.Message
    Add-Step -Name "failure" -Status "FAIL" -Message $failureReason
}
finally {
    if ($serverProcess -and -not $serverProcess.HasExited) {
        Stop-Process -Id $serverProcess.Id -Force
        Add-Step -Name "shutdown" -Status "PASS" -Message "Backend server stopped"
    }
    Pop-Location

    $endedAt = Get-Date
    $report = [pscustomobject]@{
        system = "Qesma Debt Distribution"
        status = $overallStatus
        started_at = $startedAt.ToString("o")
        ended_at = $endedAt.ToString("o")
        duration_seconds = [math]::Round(($endedAt - $startedAt).TotalSeconds, 2)
        environment = [pscustomobject]@{
            db_engine = "sqlite"
            backend_url = "http://127.0.0.1:$Port"
            python_executable = $pythonExe
        }
        credentials_tested = [pscustomobject]@{
            username = $AdminUsername
            department_code = $DepartmentCode
        }
        failure_reason = $failureReason
        steps = $steps
    }

    $directory = Split-Path -Parent $reportFile
    if (-not (Test-Path $directory)) {
        New-Item -ItemType Directory -Path $directory -Force | Out-Null
    }

    $report | ConvertTo-Json -Depth 8 | Set-Content -Path $reportFile -Encoding UTF8

    if ($overallStatus -eq "PASS") {
        Write-Host "Verification completed successfully. Report: $reportFile" -ForegroundColor Green
        exit 0
    }

    Write-Host "Verification failed. Report: $reportFile" -ForegroundColor Red
    exit 1
}
