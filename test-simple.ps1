# Simple Direct Test - No Database Queries
# This test will use trial-and-error with HTTP endpoints

$baseUrl = "http://localhost:4000"

Write-Host "`n======================================================" -ForegroundColor Cyan
Write-Host "DIRECT HTTP INTEGRATION TEST" -ForegroundColor Cyan
Write-Host "======================================================`n" -ForegroundColor Cyan

# List to track results
$results = @()

function LogResult {
    param([string]$test, [bool]$pass, [string]$details)
    $status = if ($pass) { "PASS" } else { "FAIL" }
    Write-Host ("       [{0}] {1}" -f $status, $test) -ForegroundColor $(if($pass){'Green'}else{'Red'})
    Write-Host ("            {0}`n" -f $details) -ForegroundColor Gray
    $results += @{Test=$test; Pass=$pass}
}

# Test 1: Can we create a draft?
Write-Host "TEST 1: FINALIZE FLOW" -ForegroundColor Yellow
Write-Host "============================================" -ForegroundColor Yellow

Write-Host "Creating draft..." -ForegroundColor White
$resp = Invoke-WebRequest -Uri "$baseUrl/api/drafts" -Method Post `
    -Headers @{"Content-Type"="application/json"} `
    -Body (ConvertTo-Json @{name="Test"}) -UseBasicParsing

$draft = $resp.Content | ConvertFrom-Json
$draftId = $draft.id
LogResult "Draft created" ($draft -and $draftId) "Draft ID: $draftId"

# Test 2: Can we set ability scores on draft without selecting class?
Write-Host "Testing ability score validation without class..." -ForegroundColor White
try {
    $resp = Invoke-WebRequest -Uri "$baseUrl/api/drafts/$draftId/ability-scores" -Method Post `
        -Headers @{"Content-Type"="application/json"} `
        -Body (ConvertTo-Json @{
            method = "standard_array"
            str = 15; dex = 14; con = 13; int = 12; wis = 10; cha = 8
        }) -UseBasicParsing
    
    $draft2 = $resp.Content | ConvertFrom-Json
    $hasScores = $draft2.abilityScores -and $draft2.abilityScores.str -eq 15
    LogResult "Set Ability Scores" $hasScores "Ability scores set successfully"
} catch {
    LogResult "Set Ability Scores" $false "Error: $($_.Exception.Message)"
}

# Test 3: Validation Test - Invalid standard array
Write-Host "`nTEST 2: VALIDATION" -ForegroundColor Yellow
Write-Host "============================================" -ForegroundColor Yellow

Write-Host "Creating validation test draft..." -ForegroundColor White
$resp = Invoke-WebRequest -Uri "$baseUrl/api/drafts" -Method Post `
    -Headers @{"Content-Type"="application/json"} `
    -Body (ConvertTo-Json @{name="Validation"}) -UseBasicParsing
$valDraft = $resp.Content | ConvertFrom-Json
$valDraftId = $valDraft.id

Write-Host "Testing invalid standard_array (two 15s)..." -ForegroundColor White
try {
    $resp = Invoke-WebRequest -Uri "$baseUrl/api/drafts/$valDraftId/ability-scores" -Method Post `
        -Headers @{"Content-Type"="application/json"} `
        -Body (ConvertTo-Json @{
            method = "standard_array"
            str = 15; dex = 15; con = 13; int = 12; wis = 10; cha = 8
        }) -UseBasicParsing
    
    LogResult "Reject invalid standard_array" $false "Should have returned 400"
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    LogResult "Reject invalid standard_array" ($statusCode -eq 400) "Returned status $statusCode"
}

Write-Host "Testing manual with score=2 (too low)..." -ForegroundColor White
try {
    $resp = Invoke-WebRequest -Uri "$baseUrl/api/drafts/$valDraftId/ability-scores" -Method Post `
        -Headers @{"Content-Type"="application/json"} `
        -Body (ConvertTo-Json @{
            method = "manual"
            str = 2; dex = 14; con = 13; int = 12; wis = 10; cha = 8
        }) -UseBasicParsing
    
    LogResult "Reject score too low (2)" $false "Should have returned 400"
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    LogResult "Reject score too low (2)" ($statusCode -eq 400) "Returned status $statusCode"
}

Write-Host "Testing manual with score=25 (too high)..." -ForegroundColor White
try {
    $resp = Invoke-WebRequest -Uri "$baseUrl/api/drafts/$valDraftId/ability-scores" -Method Post `
        -Headers @{"Content-Type"="application/json"} `
        -Body (ConvertTo-Json @{
            method = "manual"
            str = 25; dex = 14; con = 13; int = 12; wis = 10; cha = 8
        }) -UseBasicParsing
    
    LogResult "Reject score too high (25)" $false "Should have returned 400"
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    LogResult "Reject score too high (25)" ($statusCode -eq 400) "Returned status $statusCode"
}

# Test 4: Idempotency
Write-Host "`nTEST 3: IDEMPOTENCY" -ForegroundColor Yellow
Write-Host "============================================" -ForegroundColor Yellow

Write-Host "Creating idempotency test draft..." -ForegroundColor White
$resp = Invoke-WebRequest -Uri "$baseUrl/api/drafts" -Method Post `
    -Headers @{"Content-Type"="application/json"} `
    -Body (ConvertTo-Json @{name="Idempotency"}) -UseBasicParsing
$idempDraft = $resp.Content | ConvertFrom-Json
$idempDraftId = $idempDraft.id

Write-Host "Setting ability scores first time..." -ForegroundColor White
$resp = Invoke-WebRequest -Uri "$baseUrl/api/drafts/$idempDraftId/ability-scores" -Method Post `
    -Headers @{"Content-Type"="application/json"} `
    -Body (ConvertTo-Json @{
        method = "standard_array"
        str = 15; dex = 14; con = 13; int = 12; wis = 10; cha = 8
    }) -UseBasicParsing
$draft1 = $resp.Content | ConvertFrom-Json
$scoreId1 = $draft1.abilityScores.id

LogResult "First ability score set" ($draft1.abilityScores.str -eq 15) "Score ID: $scoreId1"

Write-Host "Updating ability scores (manual method)..." -ForegroundColor White
$resp = Invoke-WebRequest -Uri "$baseUrl/api/drafts/$idempDraftId/ability-scores" -Method Post `
    -Headers @{"Content-Type"="application/json"} `
    -Body (ConvertTo-Json @{
        method = "manual"
        str = 16; dex = 14; con = 15; int = 12; wis = 13; cha = 11
    }) -UseBasicParsing
$draft2 = $resp.Content | ConvertFrom-Json
$scoreId2 = $draft2.abilityScores.id

$updated = $draft2.abilityScores.str -eq 16 -and $draft2.abilityScores.method -eq "manual"
LogResult "Updated ability scores" $updated "New str=16, method=manual"

$sameId = ($scoreId1 -eq $scoreId2)
LogResult "Same ID (not duplicated)" $sameId "ID1: $scoreId1, ID2: $scoreId2"

# Summary
Write-Host "`n======================================================" -ForegroundColor Cyan
Write-Host "TEST SUMMARY" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan

$passed = ($results | Where-Object { $_.Pass -eq $true }).Count
$failed = ($results | Where-Object { $_.Pass -eq $false }).Count
$total = $results.Count

Write-Host "`nTotal: $total | Passed: $passed | Failed: $failed"

if ($failed -eq 0) {
    Write-Host "`nSTATUS: ALL TESTS PASSED - System is stable!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "`nSTATUS: $failed TESTS FAILED" -ForegroundColor Red
    exit 1
}
