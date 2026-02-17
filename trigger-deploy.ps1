param(
    [string]$Branch = "main",
    [switch]$NoPush
)

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $repoRoot

$triggerFile = Join-Path $repoRoot "deploy-trigger.txt"
$timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss K")
$content = "Last deploy trigger: $timestamp"

Set-Content -Path $triggerFile -Value $content -Encoding UTF8

Write-Host "Updated deploy trigger file: $triggerFile" -ForegroundColor Cyan

git add deploy-trigger.txt

$commitMessage = "chore: trigger deploy $timestamp"
git commit -m $commitMessage
if ($LASTEXITCODE -ne 0) {
    Write-Host "Git commit failed. Check repository status and try again." -ForegroundColor Red
    exit $LASTEXITCODE
}

if ($NoPush) {
    Write-Host "Commit created locally (push skipped due to -NoPush)." -ForegroundColor Yellow
    exit 0
}

git push origin $Branch
if ($LASTEXITCODE -ne 0) {
    Write-Host "Git push failed. Check remote/branch settings." -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host "Deploy trigger pushed to origin/$Branch. Render auto-deploy should start." -ForegroundColor Green
