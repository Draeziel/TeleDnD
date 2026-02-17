param(
    [string]$BaseUrl = "https://telednd-backend.onrender.com",
    [string]$CharacterName = "SmokeTestHero",
    [string]$TestTelegramUserId = "123456789"
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$runTestsPath = Join-Path $scriptDir "run-tests.ps1"

if (-not (Test-Path $runTestsPath)) {
    Write-Host "run-tests.ps1 not found at: $runTestsPath" -ForegroundColor Red
    exit 1
}

& $runTestsPath -Smoke -BaseUrl $BaseUrl -CharacterName $CharacterName -TestTelegramUserId $TestTelegramUserId
exit $LASTEXITCODE
