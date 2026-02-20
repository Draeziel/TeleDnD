param(
    [string]$BaseUrl = "https://telednd-backend.onrender.com",
    [string]$CharacterName = "SmokeTestHero",
    [string]$TestTelegramUserId = "123456789",
    [string]$TelegramInitData = "",
    [double]$MaxErrorRatePct = -1,
    [double]$MaxSlowRatePct = -1,
    [switch]$RunCombatAutomation
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$runTestsPath = Join-Path $scriptDir "run-tests.ps1"
$combatAutomationPath = Join-Path $scriptDir "test-combat-automation.ps1"
$verifyLocalDbPath = Join-Path $scriptDir "scripts\verify-local-db.ps1"

$isLocalBaseUrl = $BaseUrl -match '^https?://(localhost|127\.0\.0\.1)(:\d+)?/?$'

if ($isLocalBaseUrl) {
    if (-not (Test-Path $verifyLocalDbPath)) {
        Write-Host "verify-local-db.ps1 not found at: $verifyLocalDbPath" -ForegroundColor Red
        exit 1
    }

    Write-Host "Running local DB schema pre-check..." -ForegroundColor Cyan
    & $verifyLocalDbPath
    $verifyExitCode = $LASTEXITCODE
    if ($verifyExitCode -ne 0) {
        Write-Host "Local DB schema pre-check failed. Resolve schema drift before smoke run." -ForegroundColor Red
        Write-Host "Tip: run 'npm run verify:localdb:fix' for initiative_locked-only drift, otherwise run 'npx prisma migrate deploy'." -ForegroundColor Yellow
        exit $verifyExitCode
    }
}

if (-not (Test-Path $runTestsPath)) {
    Write-Host "run-tests.ps1 not found at: $runTestsPath" -ForegroundColor Red
    exit 1
}

& $runTestsPath -Smoke -BaseUrl $BaseUrl -CharacterName $CharacterName -TestTelegramUserId $TestTelegramUserId -TelegramInitData $TelegramInitData -MaxErrorRatePct $MaxErrorRatePct -MaxSlowRatePct $MaxSlowRatePct
$smokeExitCode = $LASTEXITCODE

if ($RunCombatAutomation) {
    if (-not (Test-Path $combatAutomationPath)) {
        Write-Host "test-combat-automation.ps1 not found at: $combatAutomationPath" -ForegroundColor Red
        exit 1
    }

    Write-Host "`n======================================================" -ForegroundColor Cyan
    Write-Host "COMBAT AUTOMATION SMOKE" -ForegroundColor Cyan
    Write-Host "======================================================`n" -ForegroundColor Cyan

    & $combatAutomationPath -BaseUrl $BaseUrl -TestTelegramUserId $TestTelegramUserId -TelegramInitData $TelegramInitData
    $combatExitCode = $LASTEXITCODE

    if ($smokeExitCode -ne 0 -or $combatExitCode -ne 0) {
        exit 1
    }

    exit 0
}

exit $smokeExitCode
