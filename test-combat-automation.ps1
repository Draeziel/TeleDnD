# Combat automation smoke test
# Covers: template shortLabel, immutable template snapshot on apply, auto-tick decrement/expiry, combat event payloads

param(
    [string]$BaseUrl = "http://localhost:4000",
    [string]$TestTelegramUserId = "123456789",
    [string]$TelegramInitData = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$testsPassed = 0
$testsFailed = 0

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

function Invoke-Json {
    param(
        [string]$Uri,
        [string]$Method = "GET",
        [object]$Body = $null,
        [hashtable]$Headers = @{}
    )

    $requestHeaders = @{
        "Content-Type" = "application/json"
    }

    foreach ($key in $Headers.Keys) {
        $requestHeaders[$key] = $Headers[$key]
    }

    if ($Body -ne $null) {
        $jsonBody = ConvertTo-Json $Body -Depth 20
        $response = Invoke-WebRequest -Uri $Uri -Method $Method -Headers $requestHeaders -Body $jsonBody -UseBasicParsing
    } else {
        $response = Invoke-WebRequest -Uri $Uri -Method $Method -Headers $requestHeaders -UseBasicParsing
    }

    if ([string]::IsNullOrWhiteSpace($response.Content)) {
        return $null
    }

    return ($response.Content | ConvertFrom-Json)
}

function New-IdempotencyKey {
    return ("{0}-{1}" -f [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds(), [Guid]::NewGuid().ToString("N").Substring(0, 8))
}

$authHeaders = @{}
if (-not [string]::IsNullOrWhiteSpace($TelegramInitData)) {
    $authHeaders["x-telegram-init-data"] = $TelegramInitData
} else {
    $authHeaders["x-telegram-user-id"] = $TestTelegramUserId
}

Write-Host "============================================================"
Write-Host "COMBAT AUTOMATION TEST"
Write-Host "============================================================"
Write-Host ("Base URL: " + $BaseUrl)

$sessionId = $null
$characterId = $null
$templateId = $null

try {
    $classes = Invoke-Json -Uri "$BaseUrl/api/characters/classes" -Method "GET"
    if (-not $classes -or $classes.Count -lt 1) {
        throw "No classes returned from /api/characters/classes"
    }

    $classId = $classes[0].id
    Add-TestResult "Load class for character" (-not [string]::IsNullOrWhiteSpace($classId)) ("classId=" + $classId)

    $character = Invoke-Json -Uri "$BaseUrl/api/characters" -Method "POST" -Headers $authHeaders -Body @{
        name = "CombatAutoTest_$(Get-Date -Format 'HHmmss')"
        classId = $classId
        level = 1
    }

    $characterId = $character.id
    Add-TestResult "Create character" (-not [string]::IsNullOrWhiteSpace($characterId)) ("characterId=" + $characterId)

    $session = Invoke-Json -Uri "$BaseUrl/api/sessions" -Method "POST" -Headers $authHeaders -Body @{
        name = "Combat Automation Session $(Get-Date -Format 'HHmmss')"
    }

    $sessionId = $session.id
    Add-TestResult "Create session" (-not [string]::IsNullOrWhiteSpace($sessionId)) ("sessionId=" + $sessionId)

    $attach = Invoke-Json -Uri "$BaseUrl/api/sessions/$sessionId/characters" -Method "POST" -Headers $authHeaders -Body @{
        characterId = $characterId
    }

    Add-TestResult "Attach character" (-not [string]::IsNullOrWhiteSpace($attach.sessionCharacterId)) ("sessionCharacterId=" + $attach.sessionCharacterId)

    $null = Invoke-Json -Uri "$BaseUrl/api/sessions/$sessionId/characters/$characterId/set-initiative" -Method "POST" -Headers $authHeaders -Body @{
        initiative = 20
    }
    Add-TestResult "Set initiative" $true "initiative=20"

    $template = Invoke-Json -Uri "$BaseUrl/api/monsters/status-templates" -Method "POST" -Headers $authHeaders -Body @{
        name = "Automation Poison Test"
        shortLabel = "POI"
        statusType = "DAMAGE"
        statusElement = "POISON"
        rounds = 2
        damageDiceCount = 1
        damageDiceSides = 2
        saveAbility = "con"
        saveDiceCount = 1
        saveDiceSides = 20
        saveOperator = ">="
        saveTargetValue = 100
        saveDamagePercent = 100
        colorHex = "#5b9cff"
        isActive = $true
    }

    $templateId = $template.id
    $templateShortLabel = $template.payload.meta.shortLabel
    Add-TestResult "Create status template with shortLabel" (-not [string]::IsNullOrWhiteSpace($templateId) -and $templateShortLabel -eq "POI") ("templateId=$templateId shortLabel=$templateShortLabel")

    $applyAction = Invoke-Json -Uri "$BaseUrl/api/sessions/$sessionId/combat/action" -Method "POST" -Headers $authHeaders -Body @{
        idempotencyKey = New-IdempotencyKey
        actionType = "APPLY_CHARACTER_EFFECT"
        payload = @{
            characterId = $characterId
            templateId = $templateId
        }
    }

    $appliedEffect = $applyAction.result
    $snapshot = $appliedEffect.payload.meta.templateSnapshot
    $snapshotOk = $snapshot -and $snapshot.id -eq $templateId -and $snapshot.name -eq "Automation Poison Test"
    Add-TestResult "Persist template snapshot on apply" $snapshotOk ("snapshotId=" + $snapshot.id)

    $startEncounterAction = Invoke-Json -Uri "$BaseUrl/api/sessions/$sessionId/combat/action" -Method "POST" -Headers $authHeaders -Body @{
        idempotencyKey = New-IdempotencyKey
        actionType = "START_ENCOUNTER"
        payload = @{}
    }
    Add-TestResult "Start encounter" ($startEncounterAction.result.encounterActive -eq $true) "encounterActive=true"

    $nextTurn1 = Invoke-Json -Uri "$BaseUrl/api/sessions/$sessionId/combat/action" -Method "POST" -Headers $authHeaders -Body @{
        idempotencyKey = New-IdempotencyKey
        actionType = "NEXT_TURN"
        payload = @{}
    }

    $sessionAfterTick1 = Invoke-Json -Uri "$BaseUrl/api/sessions/$sessionId" -Method "GET" -Headers $authHeaders
    $entry1 = $sessionAfterTick1.characters | Where-Object { $_.character.id -eq $characterId } | Select-Object -First 1
    $duration1 = if ($entry1.effects.Count -gt 0) { $entry1.effects[0].duration } else { "<none>" }
    Add-TestResult "Effect remains after 1st tick" ($entry1.effects.Count -eq 1) ("duration=" + $duration1)

    $nextTurn2 = Invoke-Json -Uri "$BaseUrl/api/sessions/$sessionId/combat/action" -Method "POST" -Headers $authHeaders -Body @{
        idempotencyKey = New-IdempotencyKey
        actionType = "NEXT_TURN"
        payload = @{}
    }

    $sessionAfterTick2 = Invoke-Json -Uri "$BaseUrl/api/sessions/$sessionId" -Method "GET" -Headers $authHeaders
    $entry2 = $sessionAfterTick2.characters | Where-Object { $_.character.id -eq $characterId } | Select-Object -First 1
    Add-TestResult "Effect expires after 2nd tick" ($entry2.effects.Count -eq 0) "effects=0"

    $events = Invoke-Json -Uri "$BaseUrl/api/sessions/$sessionId/events?limit=100" -Method "GET" -Headers $authHeaders
    $effectAppliedEvent = $events | Where-Object { $_.type -eq "effect_applied" } | Select-Object -First 1
    $autoTickEvent = $events | Where-Object { $_.type -eq "effect_auto_tick" } | Select-Object -First 1

    Add-TestResult "effect_applied is COMBAT event" ($effectAppliedEvent -and $effectAppliedEvent.eventCategory -eq "COMBAT") ("eventCategory=" + $effectAppliedEvent.eventCategory)

    $autoTickPayload = $autoTickEvent.payload
    $hasTickDetails = $autoTickPayload -and $autoTickPayload.save -and $autoTickPayload.damage
    Add-TestResult "Auto-tick event has save+damage details" $hasTickDetails "payload includes save/damage"
}
catch {
    Add-TestResult "Combat automation flow" $false $_.Exception.Message
}
finally {
    if ($templateId) {
        try {
            Invoke-WebRequest -Uri "$BaseUrl/api/monsters/status-templates/$templateId" -Method "DELETE" -Headers $authHeaders -UseBasicParsing | Out-Null
        } catch {
            Write-Host "WARN: failed to cleanup status template" -ForegroundColor Yellow
        }
    }

    if ($sessionId) {
        try {
            Invoke-WebRequest -Uri "$BaseUrl/api/sessions/$sessionId" -Method "DELETE" -Headers $authHeaders -UseBasicParsing | Out-Null
        } catch {
            Write-Host "WARN: failed to cleanup session" -ForegroundColor Yellow
        }
    }
}

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
}

Write-Host "Result: TESTS FAILED" -ForegroundColor Red
exit 1
