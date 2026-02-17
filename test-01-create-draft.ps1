$baseUrl = "http://localhost:4000"

Write-Host "TEST 1: CREATE DRAFT" -ForegroundColor Green

$draftBody = @{ name = "TestCharacter" } | ConvertTo-Json
$response = Invoke-WebRequest -Uri "$baseUrl/api/drafts" `
    -Method Post `
    -Headers @{"Content-Type"="application/json"} `
    -Body $draftBody `
    -UseBasicParsing

$draft = $response.Content | ConvertFrom-Json
$draftId = $draft.id

Write-Host "Draft ID: $draftId"
Write-Host $draft | ConvertTo-Json

$draftId | Out-File -FilePath "draftId.txt" -Force
