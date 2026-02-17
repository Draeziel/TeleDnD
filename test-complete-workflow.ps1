# Final integration test: complete character creation workflow
# This script performs the full draft creation, selection, finalize, and sheet verification steps.

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$baseUrl = "http://localhost:4000"
$testsPassed = 0
$testsFailed = 0
$psqlProfiles = @(
    @{ User = "postgres"; Password = "Fat3Br1nger" },
    @{ User = "user"; Password = "password" }
)

function Add-TestResult {
    param(
        [string]$Name,
        [bool]$Condition,
        [string]$Details = ""
    )

    if ($Condition) {
        Write-Host ("PASS: " + $Name) -ForegroundColor Green
        if ($Details) {
            Write-Host ("      " + $Details) -ForegroundColor DarkGray
        }
        $script:testsPassed++
    } else {
        Write-Host ("FAIL: " + $Name) -ForegroundColor Red
        if ($Details) {
            Write-Host ("      " + $Details) -ForegroundColor Red
        }
        $script:testsFailed++
    }
}

function Invoke-GetJson {
    param([string]$Uri)
    $response = Invoke-WebRequest -Uri $Uri -Method Get -UseBasicParsing
    return $response.Content | ConvertFrom-Json
}

function Invoke-PostJson {
    param(
        [string]$Uri,
        [hashtable]$Body
    )

    $jsonBody = if ($Body) { ConvertTo-Json $Body -Depth 10 } else { "{}" }
    $response = Invoke-WebRequest -Uri $Uri -Method Post `
        -Headers @{"Content-Type" = "application/json"} `
        -Body $jsonBody `
        -UseBasicParsing
    return $response.Content | ConvertFrom-Json
}

Write-Host "============================================================"
Write-Host "FINAL INTEGRATION TEST: COMPLETE WORKFLOW"
Write-Host "============================================================"

# Step 0: Load base IDs from the database so downstream calls can use stable references.
Write-Host "STEP 0: Load content identifiers"

function Get-DbId {
    param([string]$Query)

    foreach ($profile in $psqlProfiles) {
        try {
            $Env:PGPASSWORD = $profile.Password
            $output = & psql -U $profile.User -h localhost -d rpg_character_db -t -A -c $Query 2>&1
            if ($LASTEXITCODE -eq 0) {
                $raw = $output | Out-String
                $value = $raw.Trim()
                if ($value) {
                    return $value
                }
            } else {
                $message = ($output | Out-String).Trim()
                if ($message) {
                    Write-Host ("INFO: psql query failed for user " + $profile.User + ": " + $message) -ForegroundColor DarkYellow
                }
            }
        } catch {
            Write-Host ("INFO: psql invocation threw for user " + $profile.User + ": " + $_.Exception.Message) -ForegroundColor DarkYellow
        }
    }

    throw "Unable to execute psql query with available credentials."
}

try {
    $classId = Get-DbId 'SELECT id FROM classes WHERE name=''Barbarian'' LIMIT 1;'
    $raceId = Get-DbId 'SELECT id FROM races WHERE name=''Human'' LIMIT 1;'
    $backgroundId = Get-DbId 'SELECT id FROM backgrounds WHERE name=''Soldier'' LIMIT 1;'
    $choiceId = Get-DbId 'SELECT id FROM choices LIMIT 1;'

    $allIdsPresent = $classId -and $raceId -and $backgroundId -and $choiceId
    $idDetails = "class=" + $classId + ", race=" + $raceId + ", background=" + $backgroundId + ", choice=" + $choiceId
    Add-TestResult "Content IDs available" $allIdsPresent $idDetails

    if (-not $allIdsPresent) {
        throw "Unable to obtain required IDs."
    }
} catch {
    Add-TestResult "Content ID lookup succeeded" $false $_.Exception.Message
    throw
}

# Step 1: Create draft
Write-Host "STEP 1: Create draft"
$draft = Invoke-PostJson "$baseUrl/api/drafts" @{ name = "Integration Test Character" }
$draftId = $draft.id
Add-TestResult "Draft created" ($null -ne $draftId) ("draftId=" + $draftId)
Add-TestResult "Draft starts empty" (
    -not $draft.classId -and -not $draft.raceId -and -not $draft.backgroundId
) "class/race/background empty"

# Step 2: Select class
Write-Host "STEP 2: Select class"
$draft = Invoke-PostJson "$baseUrl/api/drafts/$draftId/class" @{ classId = $classId }
Add-TestResult "Class set" ($draft.class.id -eq $classId) ("classId=" + $draft.class.id)

# Step 3: Select race
Write-Host "STEP 3: Select race"
$draft = Invoke-PostJson "$baseUrl/api/drafts/$draftId/race" @{ raceId = $raceId }
Add-TestResult "Race set" ($draft.race.id -eq $raceId) ("raceId=" + $draft.race.id)

# Step 4: Select background
Write-Host "STEP 4: Select background"
$draft = Invoke-PostJson "$baseUrl/api/drafts/$draftId/background" @{ backgroundId = $backgroundId }
Add-TestResult "Background set" ($draft.background.id -eq $backgroundId) ("backgroundId=" + $draft.background.id)
Add-TestResult "Choices combined" ($draft.requiredChoices.Count -gt 0) ("total choices=" + $draft.requiredChoices.Count)

# Step 5: Assign ability scores using the standard array
Write-Host "STEP 5: Assign ability scores"
$draft = Invoke-PostJson "$baseUrl/api/drafts/$draftId/ability-scores" @{
    method = "standard_array"
    str = 15
    dex = 14
    con = 13
    int = 12
    wis = 10
    cha = 8
}

$abilityScores = $draft.abilityScores
$abilityScoreSetId = if ($abilityScores -and $abilityScores.id) { $abilityScores.id } else { "<missing>" }
Add-TestResult "Ability scores stored" (
    $abilityScores -ne $null -and $abilityScores.str -eq 15 -and $abilityScores.id
) ("abilityScoreSetId=" + $abilityScoreSetId)

# Step 6: Complete all required choices
Write-Host "STEP 6: Complete required choices"
$draft = Invoke-GetJson "$baseUrl/api/drafts/$draftId"
$missingChoices = @($draft.missingChoices)
$choiceSaves = 0

foreach ($choice in $missingChoices) {
    $options = @($choice.options)
    if ($options.Count -eq 0) {
        continue
    }

    $selected = $options[0]
    $selectedId = if ($selected -is [string]) { $selected } else { $selected.id }

    Invoke-PostJson "$baseUrl/api/drafts/$draftId/choices" @{
        choiceId = $choice.id
        selectedOption = $selectedId
    } | Out-Null

    $choiceSaves++
}

Add-TestResult "All choices submitted" ($choiceSaves -eq $missingChoices.Count) ("count=" + $choiceSaves)

$draft = Invoke-GetJson "$baseUrl/api/drafts/$draftId"
Add-TestResult "No missing choices" ($draft.missingChoices.Count -eq 0) ("remaining=" + $draft.missingChoices.Count)
Add-TestResult "Selected choices recorded" ($draft.selectedChoices.Count -gt 0) ("selected=" + $draft.selectedChoices.Count)

# Step 7: Finalize draft
Write-Host "STEP 7: Finalize draft"
$finalization = Invoke-PostJson "$baseUrl/api/drafts/$draftId/finalize" @{}
$characterId = $finalization.characterId
Add-TestResult "Finalize returned character" ($null -ne $characterId) ("characterId=" + $characterId)
Add-TestResult "Finalize success message" ($finalization.message -eq "Character created successfully") $finalization.message

# Step 8: Retrieve character sheet
Write-Host "STEP 8: Retrieve character sheet"
$sheet = Invoke-GetJson "$baseUrl/api/characters/$characterId/sheet"
$character = $sheet.character

Add-TestResult "Character sheet loaded" ($character -ne $null) ("name=" + $character.name)
Add-TestResult "Character class present" ($character.class -ne $null) ("class=" + $character.class.name)
Add-TestResult "Character race present" ($character.race -ne $null) ("race=" + $character.race.name)
Add-TestResult "Character background present" ($character.background -ne $null) ("background=" + $character.background.name)

$sheetScores = $character.abilityScores
Add-TestResult "Ability scores copied" (
    $sheetScores -ne $null -and $sheetScores.str -eq 15 -and $sheetScores.dex -eq 14 -and $sheetScores.con -eq 13 -and $sheetScores.int -eq 12 -and $sheetScores.wis -eq 10 -and $sheetScores.cha -eq 8
) "scores str=15 dex=14 con=13 int=12 wis=10 cha=8"
Add-TestResult "Ability score method preserved" ($sheetScores.method -eq "standard_array") ("method=" + $sheetScores.method)

$features = @($sheet.features)
$totalFeatureCount = $features.Count
$classFeatureCount = @($features | Where-Object { $_.source -eq "class" }).Count
$raceFeatureCount = @($features | Where-Object { $_.source -eq "race" }).Count
$backgroundFeatureCount = @($features | Where-Object { $_.source -eq "background" }).Count

Add-TestResult "Features available" ($totalFeatureCount -gt 0) ("feature count=" + $totalFeatureCount)
Add-TestResult "Class features included" ($classFeatureCount -gt 0) ("class features=" + $classFeatureCount)
Add-TestResult "Race features included" ($raceFeatureCount -gt 0) ("race features=" + $raceFeatureCount)
Add-TestResult "Background features included" ($backgroundFeatureCount -gt 0) ("background features=" + $backgroundFeatureCount)

Add-TestResult "Sheet missing choices clear" ($sheet.missingChoices.Count -eq 0) ("remaining=" + $sheet.missingChoices.Count)
Add-TestResult "Sheet selected choices present" ($sheet.selectedChoices.Count -gt 0) ("count=" + $sheet.selectedChoices.Count)
Add-TestResult "Sheet required choices present" ($sheet.requiredChoices.Count -gt 0) ("count=" + $sheet.requiredChoices.Count)

Write-Host "============================================================"
Write-Host "TEST SUMMARY"
Write-Host "============================================================"
$total = $testsPassed + $testsFailed
Write-Host ("Total tests: " + $total)
Write-Host ("Passed: " + $testsPassed)
Write-Host ("Failed: " + $testsFailed)

if ($testsFailed -eq 0) {
    Write-Host "Result: ALL TESTS PASSED" -ForegroundColor Green
    exit 0
} else {
    Write-Host "Result: TESTS FAILED" -ForegroundColor Red
    exit 1
}
