param(
    [string]$BaseUrl = "https://telednd-backend.onrender.com",
    [string]$CharacterName = "SmokeTestHero",
    [string]$TestTelegramUserId = "123456789",
    [string]$TelegramInitData = "",
    [double]$MaxErrorRatePct = -1,
    [double]$MaxSlowRatePct = -1
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$runTestsPath = Join-Path $scriptDir "run-tests.ps1"

if (-not (Test-Path $runTestsPath)) {
    Write-Host "run-tests.ps1 not found at: $runTestsPath" -ForegroundColor Red
    exit 1
}

& $runTestsPath -Smoke -BaseUrl $BaseUrl -CharacterName $CharacterName -TestTelegramUserId $TestTelegramUserId -TelegramInitData $TelegramInitData -MaxErrorRatePct $MaxErrorRatePct -MaxSlowRatePct $MaxSlowRatePct
exit $LASTEXITCODE
