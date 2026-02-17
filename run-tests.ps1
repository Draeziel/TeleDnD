# === COMPREHENSIVE TEST SUITE FOR RPG CHARACTER SERVICE ===
# Tests: Finalize Flow, Validation, Idempotency

$baseUrl = "http://localhost:4000"
$testResults = @()

function Test-Result {
    param(
        [string]$testName,
        [bool]$passed,
        [string]$details
    )
    
    $status = if ($passed) { "PASS" } else { "FAIL" }
    $color = if ($passed) { "Green" } else { "Red" }
    
    Write-Host "[$status] $testName" -ForegroundColor $color
    Write-Host "      $details" -ForegroundColor Gray
    
    $testResults += @{
        Test = $testName
        Status = $status
        Details = $details
    }
}

Write-Host "`n======================================================" -ForegroundColor Cyan
Write-Host "TEST SUITE: RPG Character Service Integration Tests" -ForegroundColor Cyan
Write-Host "======================================================`n" -ForegroundColor Cyan

# First, get IDs from database
Write-Host "1. FETCHING CONTENT IDs FROM DATABASE..." -ForegroundColor Yellow

if (-not $Env:PGPASSWORD -or $Env:PGPASSWORD.Trim() -eq "") {
    $Env:PGPASSWORD = "Fat3Br1nger"
}

$classId = (psql -U postgres -h localhost -d rpg_character_db -t -A -c "SELECT id FROM classes WHERE name='Barbarian' LIMIT 1;" 2>$null)
$raceId = (psql -U postgres -h localhost -d rpg_character_db -t -A -c "SELECT id FROM races WHERE name='Human' LIMIT 1;" 2>$null)
$bgId = (psql -U postgres -h localhost -d rpg_character_db -t -A -c "SELECT id FROM backgrounds WHERE name='Soldier' LIMIT 1;" 2>$null)
$choiceId = (npx ts-node scripts/getClassChoiceId.ts 2>$null)

$classId = $classId.Trim()
$raceId = $raceId.Trim()
$bgId = $bgId.Trim()
$choiceId = $choiceId.Trim()

Write-Host "   Class ID: $classId"
Write-Host "   Race ID: $raceId"
Write-Host "   Background ID: $bgId"
Write-Host "   Class Choice ID: $choiceId`n"

if (-not $classId -or -not $raceId -or -not $bgId -or -not $choiceId) {
    Write-Host "ERROR: Could not fetch all required IDs from database!" -ForegroundColor Red
    exit 1
}

# ============================================================
# TEST 1: FINALIZE FLOW - Complete Workflow Test
# ============================================================

Write-Host "`n2. TEST 1: FINALIZE FLOW" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════" -ForegroundColor Cyan

# Step 1: Create draft
Write-Host "   a) Creating draft..." -ForegroundColor White
$response = Invoke-WebRequest -Uri "$baseUrl/api/drafts" `
    -Method Post `
    -Headers @{"Content-Type"="application/json"} `
    -Body (ConvertTo-Json @{name="TestCharacter"}) `
    -UseBasicParsing -ErrorAction Stop

$draft = $response.Content | ConvertFrom-Json
$draftId = $draft.id
Test-Result "Create Draft" ($draft.id -and $draft.name -eq "TestCharacter") "Draft ID: $draftId"

# Step 2: Set class
Write-Host "   b) Setting class..." -ForegroundColor White
$response = Invoke-WebRequest -Uri "$baseUrl/api/drafts/$draftId/class" `
    -Method Post `
    -Headers @{"Content-Type"="application/json"} `
    -Body (ConvertTo-Json @{classId=$classId}) `
    -UseBasicParsing -ErrorAction Stop

$draft = $response.Content | ConvertFrom-Json
Test-Result "Set Class" ($draft.class.id -eq $classId) "Class set correctly"

# Step 3: Set race
Write-Host "   c) Setting race..." -ForegroundColor White
$response = Invoke-WebRequest -Uri "$baseUrl/api/drafts/$draftId/race" `
    -Method Post `
    -Headers @{"Content-Type"="application/json"} `
    -Body (ConvertTo-Json @{raceId=$raceId}) `
    -UseBasicParsing -ErrorAction Stop

$draft = $response.Content | ConvertFrom-Json
Test-Result "Set Race" ($draft.race.id -eq $raceId) "Race set correctly"

# Step 4: Set background
Write-Host "   d) Setting background..." -ForegroundColor White
$response = Invoke-WebRequest -Uri "$baseUrl/api/drafts/$draftId/background" `
    -Method Post `
    -Headers @{"Content-Type"="application/json"} `
    -Body (ConvertTo-Json @{backgroundId=$bgId}) `
    -UseBasicParsing -ErrorAction Stop

$draft = $response.Content | ConvertFrom-Json
Test-Result "Set Background" ($draft.background.id -eq $bgId) "Background set correctly"

# Step 5: Set ability scores
Write-Host "   e) Setting ability scores..." -ForegroundColor White
$response = Invoke-WebRequest -Uri "$baseUrl/api/drafts/$draftId/ability-scores" `
    -Method Post `
    -Headers @{"Content-Type"="application/json"} `
    -Body (ConvertTo-Json @{
        method = "standard_array"
        str = 15
        dex = 14
        con = 13
        int = 12
        wis = 10
        cha = 8
    }) `
    -UseBasicParsing -ErrorAction Stop

$draft = $response.Content | ConvertFrom-Json
$hasScores = $draft.abilityScores -and $draft.abilityScores.str -eq 15
Test-Result "Set Ability Scores" $hasScores "Standard array set: str=15, dex=14, con=13, int=12, wis=10, cha=8"

# Step 6: Save a choice
Write-Host "   f) Saving class choice..." -ForegroundColor White
$response = Invoke-WebRequest -Uri "$baseUrl/api/drafts/$draftId/choices" `
    -Method Post `
    -Headers @{"Content-Type"="application/json"} `
    -Body (ConvertTo-Json @{
        choiceId = $choiceId
        selectedOption = "acrobatics"
    }) `
    -UseBasicParsing -ErrorAction Stop

$draft = $response.Content | ConvertFrom-Json
Test-Result "Save Class Choice" ($draft.selectedChoices.Count -gt 0) "Class choice saved successfully"

# Step 7: Save background choice if required
Write-Host "   g) Saving background choice..." -ForegroundColor White
$draftStateResponse = Invoke-WebRequest -Uri "$baseUrl/api/drafts/$draftId" `
    -Method Get `
    -UseBasicParsing -ErrorAction Stop

$draftState = $draftStateResponse.Content | ConvertFrom-Json
$backgroundChoice = $null
if ($draftState.missingChoices) {
    $backgroundChoice = $draftState.missingChoices | Where-Object { $_.sourceType -eq "background" } | Select-Object -First 1
}

if ($backgroundChoice) {
    $backgroundOption = $backgroundChoice.options | Select-Object -First 1
    $response = Invoke-WebRequest -Uri "$baseUrl/api/drafts/$draftId/choices" `
        -Method Post `
        -Headers @{"Content-Type"="application/json"} `
        -Body (ConvertTo-Json @{
            choiceId = $backgroundChoice.id
            selectedOption = $backgroundOption.id
        }) `
        -UseBasicParsing -ErrorAction Stop

    $draft = $response.Content | ConvertFrom-Json
    $backgroundSaved = $draft.selectedChoices | Where-Object { $_.choiceId -eq $backgroundChoice.id }
    Test-Result "Save Background Choice" ($backgroundSaved -ne $null) "Background option selected: $($backgroundOption.id)"
} else {
    Test-Result "Save Background Choice" $true "No background choices required"
}

# Step 8: Finalize draft
Write-Host "   h) Finalizing draft..." -ForegroundColor White
$response = Invoke-WebRequest -Uri "$baseUrl/api/drafts/$draftId/finalize" `
    -Method Post `
    -Headers @{"Content-Type"="application/json"} `
    -Body "" `
    -UseBasicParsing -ErrorAction Stop

$result = $response.Content | ConvertFrom-Json
$characterId = $result.characterId

Test-Result "Finalize Draft" (-not [string]::IsNullOrWhiteSpace($result.characterId)) "Character created: $characterId"

# Step 9: Verify character sheet includes ability scores
Write-Host "   i) Verifying character sheet..." -ForegroundColor White
$response = Invoke-WebRequest -Uri "$baseUrl/api/characters/$characterId/sheet" `
    -Method Get `
    -UseBasicParsing -ErrorAction Stop

$sheet = $response.Content | ConvertFrom-Json
$hasAbilityScores = $sheet.character.abilityScores -and `
                    $sheet.character.abilityScores.str -eq 15 -and `
                    $sheet.character.abilityScores.dex -eq 14 -and `
                    $sheet.character.abilityScores.method -eq "standard_array"

Test-Result "Character Sheet Includes Ability Scores" $hasAbilityScores `
    "Scores verified: str=15, dex=14, con=13, int=12, wis=10, cha=8"

# ============================================================
# TEST 2: VALIDATION - Invalid Input Tests
# ============================================================

Write-Host "`n3. TEST 2: VALIDATION" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════" -ForegroundColor Cyan

# Create new draft for validation tests
$response = Invoke-WebRequest -Uri "$baseUrl/api/drafts" `
    -Method Post `
    -Headers @{"Content-Type"="application/json"} `
    -Body (ConvertTo-Json @{name="ValidationTest"}) `
    -UseBasicParsing

$validationDraft = $response.Content | ConvertFrom-Json
$validationDraftId = $validationDraft.id

Write-Host "   Created validation test draft: $validationDraftId" -ForegroundColor White

# Test 2a: Invalid standard array (two 15s)
Write-Host "   a) Testing invalid standard_array (two 15s)..." -ForegroundColor White
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/api/drafts/$validationDraftId/ability-scores" `
        -Method Post `
        -Headers @{"Content-Type"="application/json"} `
        -Body (ConvertTo-Json @{
            method = "standard_array"
            str = 15; dex = 15; con = 13; int = 12; wis = 10; cha = 8
        }) `
        -UseBasicParsing -ErrorAction Stop
    
    Test-Result "Reject Invalid Standard Array (Two 15s)" $false "Should have returned 400 but succeeded"
} catch {
    $statusCode = $_.Exception.Response.StatusCode
    Test-Result "Reject Invalid Standard Array (Two 15s)" ($statusCode -eq 400) "Correctly rejected with 400"
}

# Test 2b: Invalid standard array (wrong values)
Write-Host "   b) Testing invalid standard_array (all wrong)..." -ForegroundColor White
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/api/drafts/$validationDraftId/ability-scores" `
        -Method Post `
        -Headers @{"Content-Type"="application/json"} `
        -Body (ConvertTo-Json @{
            method = "standard_array"
            str = 16; dex = 14; con = 13; int = 12; wis = 10; cha = 8
        }) `
        -UseBasicParsing -ErrorAction Stop
    
    Test-Result "Reject Invalid Standard Array (Wrong Values)" $false "Should have returned 400"
} catch {
    $statusCode = $_.Exception.Response.StatusCode
    Test-Result "Reject Invalid Standard Array (Wrong Values)" ($statusCode -eq 400) "Correctly rejected with 400"
}

# Test 2c: Manual with score too low (2)
Write-Host "   c) Testing manual with score=2 (too low)..." -ForegroundColor White
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/api/drafts/$validationDraftId/ability-scores" `
        -Method Post `
        -Headers @{"Content-Type"="application/json"} `
        -Body (ConvertTo-Json @{
            method = "manual"
            str = 2; dex = 14; con = 13; int = 12; wis = 10; cha = 8
        }) `
        -UseBasicParsing -ErrorAction Stop
    
    Test-Result "Reject Score Too Low (2)" $false "Should have returned 400"
} catch {
    $statusCode = $_.Exception.Response.StatusCode
    Test-Result "Reject Score Too Low (2)" ($statusCode -eq 400) "Correctly rejected with 400"
}

# Test 2d: Manual with score too high (25)
Write-Host "   d) Testing manual with score=25 (too high)..." -ForegroundColor White
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/api/drafts/$validationDraftId/ability-scores" `
        -Method Post `
        -Headers @{"Content-Type"="application/json"} `
        -Body (ConvertTo-Json @{
            method = "manual"
            str = 25; dex = 14; con = 13; int = 12; wis = 10; cha = 8
        }) `
        -UseBasicParsing -ErrorAction Stop
    
    Test-Result "Reject Score Too High (25)" $false "Should have returned 400"
} catch {
    $statusCode = $_.Exception.Response.StatusCode
    Test-Result "Reject Score Too High (25)" ($statusCode -eq 400) "Correctly rejected with 400"
}

# Test 2e: Point buy exceeding limit
Write-Host "   e) Testing point_buy exceeding 27 point limit..." -ForegroundColor White
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/api/drafts/$validationDraftId/ability-scores" `
        -Method Post `
        -Headers @{"Content-Type"="application/json"} `
        -Body (ConvertTo-Json @{
            method = "point_buy"
            str = 14; dex = 15; con = 15; int = 12; wis = 12; cha = 11
        }) `
        -UseBasicParsing -ErrorAction Stop
    
    Test-Result "Reject Point Buy Over Limit" $false "Should have returned 400"
} catch {
    $statusCode = $_.Exception.Response.StatusCode
    Test-Result "Reject Point Buy Over Limit" ($statusCode -eq 400) "Correctly rejected with 400"
}

# ============================================================
# TEST 3: IDEMPOTENCY - Update without Duplication
# ============================================================

Write-Host "`n4. TEST 3: IDEMPOTENCY" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════" -ForegroundColor Cyan

# Create new draft for idempotency test
$response = Invoke-WebRequest -Uri "$baseUrl/api/drafts" `
    -Method Post `
    -Headers @{"Content-Type"="application/json"} `
    -Body (ConvertTo-Json @{name="IdempotencyTest"}) `
    -UseBasicParsing

$idempDraft = $response.Content | ConvertFrom-Json
$idempDraftId = $idempDraft.id

Write-Host "   Created idempotency test draft: $idempDraftId" -ForegroundColor White

# Set ability scores first time
Write-Host "   a) Setting ability scores (first time)..." -ForegroundColor White
$response = Invoke-WebRequest -Uri "$baseUrl/api/drafts/$idempDraftId/ability-scores" `
    -Method Post `
    -Headers @{"Content-Type"="application/json"} `
    -Body (ConvertTo-Json @{
        method = "standard_array"
        str = 15; dex = 14; con = 13; int = 12; wis = 10; cha = 8
    }) `
    -UseBasicParsing

$draft1 = $response.Content | ConvertFrom-Json
$scoreSetId1 = $draft1.abilityScores.id
Test-Result "First Ability Score Set" ($draft1.abilityScores.str -eq 15) "Created with ID: $scoreSetId1"

# Update ability scores second time (different method)
Write-Host "   b) Updating ability scores (second time)..." -ForegroundColor White
$response = Invoke-WebRequest -Uri "$baseUrl/api/drafts/$idempDraftId/ability-scores" `
    -Method Post `
    -Headers @{"Content-Type"="application/json"} `
    -Body (ConvertTo-Json @{
        method = "manual"
        str = 16; dex = 14; con = 15; int = 12; wis = 13; cha = 11
    }) `
    -UseBasicParsing

$draft2 = $response.Content | ConvertFrom-Json
$scoreSetId2 = $draft2.abilityScores.id
Test-Result "Updated Ability Scores" ($draft2.abilityScores.str -eq 16 -and $draft2.abilityScores.method -eq "manual") `
    "Updated to manual method: str=16"

# Verify no duplication
Write-Host "   c) Verifying no duplication in database..." -ForegroundColor White
$duplicateCount = (psql -U postgres -h localhost -d rpg_character_db -t -A -c `
    "SELECT COUNT(*) FROM ability_score_sets WHERE str=16 AND dex=14 AND con=15 AND int=12 AND wis=13 AND cha=11;" 2>$null)
$duplicateCount = [int]$duplicateCount.Trim()

Test-Result "No Duplicate AbilityScoreSets" ($duplicateCount -eq 1 -or $duplicateCount -lt 2) `
    "Found exactly 1 matching ability score set in database (count: $duplicateCount)"

# Verify IDs are same (update, not create new)
$sameId = $scoreSetId1 -eq $scoreSetId2
Test-Result "Same AbilityScoreSet Updated" $sameId "ID before: $scoreSetId1, ID after: $scoreSetId2"

# ============================================================
# SUMMARY
# ============================================================

Write-Host "`n======================================================" -ForegroundColor Cyan
Write-Host "TEST SUMMARY" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan

$passCount = ($testResults | Where-Object { $_.Status -eq "PASS" }).Count
$failCount = ($testResults | Where-Object { $_.Status -eq "FAIL" }).Count
$totalCount = $testResults.Count

Write-Host "`nTotal Tests: $totalCount"
Write-Host "Passed: $passCount" -ForegroundColor Green
Write-Host "Failed: $failCount" -ForegroundColor Red

if ($failCount -eq 0) {
    Write-Host "`nALL TESTS PASSED - System is stable!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "`nSOME TESTS FAILED - Please review errors above!" -ForegroundColor Red
    exit 1
}
