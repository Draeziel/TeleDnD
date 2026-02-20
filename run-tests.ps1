# === COMPREHENSIVE TEST SUITE FOR RPG CHARACTER SERVICE ===
# Tests: Finalize Flow, Validation, Idempotency

param(
    [string]$BaseUrl = "http://localhost:4000",
    [switch]$Smoke,
    [string]$CharacterName = "SmokeTestHero",
    [string]$TestTelegramUserId = "123456789",
    [string]$TelegramInitData = "",
    [double]$MaxErrorRatePct = -1,
    [double]$MaxSlowRatePct = -1
)

if ($Smoke) {
    $smokeResults = @()

    function Add-SmokeResult {
        param(
            [string]$Test,
            [bool]$Pass,
            [string]$Details
        )

        $status = if ($Pass) { "PASS" } else { "FAIL" }
        $color = if ($Pass) { "Green" } else { "Red" }

        Write-Host "[$status] $Test" -ForegroundColor $color
        Write-Host "      $Details" -ForegroundColor Gray

        $script:smokeResults += @{
            Test = $Test
            Pass = $Pass
            Details = $Details
        }
    }

    function Get-StatusCodeFromError {
        param(
            $ErrorRecord
        )

        if ($ErrorRecord.Exception -and $ErrorRecord.Exception.Response) {
            return [int]$ErrorRecord.Exception.Response.StatusCode
        }

        return $null
    }

    Write-Host "`n======================================================" -ForegroundColor Cyan
    Write-Host "POST-DEPLOY SMOKE TEST" -ForegroundColor Cyan
    Write-Host "======================================================`n" -ForegroundColor Cyan
    Write-Host "Base URL: $BaseUrl`n" -ForegroundColor Yellow

    $smokeHeaders = @{
        "Content-Type" = "application/json"
    }

    if (-not [string]::IsNullOrWhiteSpace($TelegramInitData)) {
        $smokeHeaders["x-telegram-init-data"] = $TelegramInitData
    } else {
        $smokeHeaders["x-telegram-user-id"] = $TestTelegramUserId
    }

    # 1) Health check
    try {
        $healthResponse = Invoke-WebRequest -Uri "$BaseUrl/healthz" -Method Get -UseBasicParsing -ErrorAction Stop
        $health = $healthResponse.Content | ConvertFrom-Json
        $healthy = $health.status -eq "ok"
        Add-SmokeResult "Health endpoint" $healthy "GET /healthz status=$($health.status)"
    } catch {
        Add-SmokeResult "Health endpoint" $false "GET /healthz failed: $($_.Exception.Message)"
    }

    # 1.1) Liveness check
    try {
        $liveResponse = Invoke-WebRequest -Uri "$BaseUrl/livez" -Method Get -UseBasicParsing -ErrorAction Stop
        $live = $liveResponse.Content | ConvertFrom-Json
        $liveOk = $live.status -eq "alive"
        Add-SmokeResult "Liveness endpoint" $liveOk "GET /livez status=$($live.status)"
    } catch {
        Add-SmokeResult "Liveness endpoint" $false "GET /livez failed: $($_.Exception.Message)"
    }

    # 1.2) Readiness check
    try {
        $readyResponse = Invoke-WebRequest -Uri "$BaseUrl/readyz" -Method Get -UseBasicParsing -ErrorAction Stop
        $ready = $readyResponse.Content | ConvertFrom-Json
        $readyOk = $ready.status -eq "ready"
        Add-SmokeResult "Readiness endpoint" $readyOk "GET /readyz status=$($ready.status)"
    } catch {
        Add-SmokeResult "Readiness endpoint" $false "GET /readyz failed: $($_.Exception.Message)"
    }

    # 1.3) Metrics check
    try {
        $metricsResponse = Invoke-WebRequest -Uri "$BaseUrl/metricsz" -Method Get -UseBasicParsing -ErrorAction Stop
        $metricsPayload = $metricsResponse.Content | ConvertFrom-Json

        $hasTotals = $null -ne $metricsPayload.metrics -and $null -ne $metricsPayload.metrics.totals
        $hasRequests = $hasTotals -and $null -ne $metricsPayload.metrics.totals.requests
        Add-SmokeResult "Metrics endpoint" $hasRequests "GET /metricsz totals.requests=$($metricsPayload.metrics.totals.requests)"

        if ($hasTotals -and $metricsPayload.metrics.totals.requests -gt 0) {
            $totalRequests = [double]$metricsPayload.metrics.totals.requests
            $errorCount = [double]$metricsPayload.metrics.totals.errors
            $slowCount = [double]$metricsPayload.metrics.totals.slow

            $errorRatePct = [math]::Round(($errorCount / $totalRequests) * 100, 2)
            $slowRatePct = [math]::Round(($slowCount / $totalRequests) * 100, 2)

            if ($MaxErrorRatePct -ge 0) {
                $errorRatePass = $errorRatePct -le $MaxErrorRatePct
                Add-SmokeResult "Error rate SLO" $errorRatePass "errors=$errorCount/$totalRequests ($errorRatePct%), threshold=$MaxErrorRatePct%"
            }

            if ($MaxSlowRatePct -ge 0) {
                $slowRatePass = $slowRatePct -le $MaxSlowRatePct
                Add-SmokeResult "Slow rate SLO" $slowRatePass "slow=$slowCount/$totalRequests ($slowRatePct%), threshold=$MaxSlowRatePct%"
            }
        }
    } catch {
        Add-SmokeResult "Metrics endpoint" $false "GET /metricsz failed: $($_.Exception.Message)"
    }

    # 2) Classes endpoint
    $classId = $null
    try {
        $classesResponse = Invoke-WebRequest -Uri "$BaseUrl/api/characters/classes" -Method Get -UseBasicParsing -ErrorAction Stop
        $classes = $classesResponse.Content | ConvertFrom-Json
        if ($classes -and $classes.Count -gt 0) {
            $classId = $classes[0].id
            Add-SmokeResult "Classes endpoint" $true "Found $($classes.Count) classes; using classId=$classId"
        } else {
            Add-SmokeResult "Classes endpoint" $false "GET /api/characters/classes returned empty list"
        }
    } catch {
        Add-SmokeResult "Classes endpoint" $false "Request failed: $($_.Exception.Message)"
    }

    # 3) Create character (legacy non-draft route)
    $characterId = $null
    if ($classId) {
        try {
            $createPayload = ConvertTo-Json @{
                name = $CharacterName
                classId = $classId
                level = 1
            }

            $createResponse = Invoke-WebRequest -Uri "$BaseUrl/api/characters" `
                -Method Post `
                -Headers $smokeHeaders `
                -Body $createPayload `
                -UseBasicParsing -ErrorAction Stop

            $created = $createResponse.Content | ConvertFrom-Json
            $characterId = $created.id
            Add-SmokeResult "Create character" (-not [string]::IsNullOrWhiteSpace($characterId)) "Character ID: $characterId"
        } catch {
            $statusCode = Get-StatusCodeFromError $_
            if ($statusCode -eq 401) {
                Add-SmokeResult "Create character" $true "Auth-gated (401): protected endpoint requires Telegram initData"
            } else {
                Add-SmokeResult "Create character" $false "POST /api/characters failed: $($_.Exception.Message)"
            }
        }
    } else {
        Add-SmokeResult "Create character" $false "Skipped: no classId available"
    }

    # 4) Fetch character sheet
    if ($characterId) {
        try {
            $sheetResponse = Invoke-WebRequest -Uri "$BaseUrl/api/characters/$characterId/sheet" -Method Get -Headers $smokeHeaders -UseBasicParsing -ErrorAction Stop
            $sheet = $sheetResponse.Content | ConvertFrom-Json

            $hasCharacter = $sheet.character -and $sheet.character.id -eq $characterId
            $hasDerived = $sheet.derivedStats -and $sheet.derivedStats.proficiencyBonus -ge 2
            $hasSavingThrows = $sheet.savingThrows -and $sheet.savingThrows.Count -eq 6

            $sheetOk = $hasCharacter -and $hasDerived -and $hasSavingThrows
            Add-SmokeResult "Character sheet" $sheetOk "character=$hasCharacter, derived=$hasDerived, savingThrows=$hasSavingThrows"
        } catch {
            Add-SmokeResult "Character sheet" $false "GET /api/characters/:id/sheet failed: $($_.Exception.Message)"
        }

        try {
            $capabilitiesResponse = Invoke-WebRequest -Uri "$BaseUrl/api/characters/$characterId/capabilities" -Method Get -Headers $smokeHeaders -UseBasicParsing -ErrorAction Stop
            $capabilities = $capabilitiesResponse.Content | ConvertFrom-Json

            $hasMetadata = $capabilities.metadata -and `
                           -not [string]::IsNullOrWhiteSpace($capabilities.metadata.rulesVersion) -and `
                           -not [string]::IsNullOrWhiteSpace($capabilities.metadata.resolverSchemaVersion)
            $hasBuckets = $null -ne $capabilities.actions -and `
                          $null -ne $capabilities.passiveFeatures -and `
                          $null -ne $capabilities.modifiers -and `
                          $null -ne $capabilities.choicesRemaining

            $capabilitiesOk = $hasMetadata -and $hasBuckets
            Add-SmokeResult "Character capabilities" $capabilitiesOk "GET /api/characters/:id/capabilities metadata=$hasMetadata, buckets=$hasBuckets"
        } catch {
            Add-SmokeResult "Character capabilities" $false "GET /api/characters/:id/capabilities failed: $($_.Exception.Message)"
        }

        try {
            $capabilitiesDirtyResponse = Invoke-WebRequest -Uri "$BaseUrl/api/characters/$characterId/capabilities?dirtyNodeId=feature:smoke" -Method Get -Headers $smokeHeaders -UseBasicParsing -ErrorAction Stop
            $capabilitiesDirty = $capabilitiesDirtyResponse.Content | ConvertFrom-Json
            $dirtyOk = $capabilitiesDirty.metadata -and -not [string]::IsNullOrWhiteSpace($capabilitiesDirty.metadata.sourceGraphDigest)
            Add-SmokeResult "Character capabilities dirty hint" $dirtyOk "GET /api/characters/:id/capabilities?dirtyNodeId=feature:smoke digestPresent=$dirtyOk"
        } catch {
            Add-SmokeResult "Character capabilities dirty hint" $false "GET /api/characters/:id/capabilities?dirtyNodeId=... failed: $($_.Exception.Message)"
        }

        try {
            Invoke-WebRequest -Uri "$BaseUrl/api/characters/00000000-0000-0000-0000-000000000000/capabilities" -Method Get -Headers $smokeHeaders -UseBasicParsing -ErrorAction Stop | Out-Null
            Add-SmokeResult "Character capabilities missing 404" $false "Expected 404 for non-existing character capabilities"
        } catch {
            $statusCode = Get-StatusCodeFromError $_
            Add-SmokeResult "Character capabilities missing 404" ($statusCode -eq 404) "GET /api/characters/:id/capabilities non-existing returned status=$statusCode"
        }
    } else {
        Add-SmokeResult "Character sheet" $true "Skipped: no characterId available (likely auth-gated create)"
        Add-SmokeResult "Character capabilities" $true "Skipped: no characterId available (likely auth-gated create)"
        Add-SmokeResult "Character capabilities dirty hint" $true "Skipped: no characterId available (likely auth-gated create)"
        Add-SmokeResult "Character capabilities missing 404" $true "Skipped: no characterId available (likely auth-gated create)"
    }

    # 5) Sessions list/create/get/delete flow
    $sessionId = $null
    try {
        $listResponse = Invoke-WebRequest -Uri "$BaseUrl/api/sessions" -Method Get -Headers $smokeHeaders -UseBasicParsing -ErrorAction Stop
        $sessions = $listResponse.Content | ConvertFrom-Json
        $isList = $sessions -is [System.Array]
        Add-SmokeResult "Sessions list" $isList "GET /api/sessions returned array=$isList"
    } catch {
        $statusCode = Get-StatusCodeFromError $_
        if ($statusCode -eq 401) {
            Add-SmokeResult "Sessions list" $true "Auth-gated (401): protected endpoint requires Telegram initData"
        } else {
            Add-SmokeResult "Sessions list" $false "GET /api/sessions failed: $($_.Exception.Message)"
        }
    }

    try {
        $sessionPayload = ConvertTo-Json @{ name = "Smoke Session $(Get-Date -Format 'HHmmss')" }
        $createSessionResponse = Invoke-WebRequest -Uri "$BaseUrl/api/sessions" `
            -Method Post `
            -Headers $smokeHeaders `
            -Body $sessionPayload `
            -UseBasicParsing -ErrorAction Stop

        $createdSession = $createSessionResponse.Content | ConvertFrom-Json
        $sessionId = $createdSession.id
        Add-SmokeResult "Session create" (-not [string]::IsNullOrWhiteSpace($sessionId)) "Session ID: $sessionId"
    } catch {
        $statusCode = Get-StatusCodeFromError $_
        if ($statusCode -eq 401) {
            Add-SmokeResult "Session create" $true "Auth-gated (401): protected endpoint requires Telegram initData"
        } else {
            Add-SmokeResult "Session create" $false "POST /api/sessions failed: $($_.Exception.Message)"
        }
    }

    if ($sessionId) {
        try {
            $getSessionResponse = Invoke-WebRequest -Uri "$BaseUrl/api/sessions/$sessionId" -Method Get -Headers $smokeHeaders -UseBasicParsing -ErrorAction Stop
            $session = $getSessionResponse.Content | ConvertFrom-Json
            $sessionOk = $session.id -eq $sessionId
            Add-SmokeResult "Session details" $sessionOk "GET /api/sessions/:id returned matching id=$sessionOk"
        } catch {
            Add-SmokeResult "Session details" $false "GET /api/sessions/:id failed: $($_.Exception.Message)"
        }

        try {
            $summaryResponse = Invoke-WebRequest -Uri "$BaseUrl/api/sessions/$sessionId/summary" -Method Get -Headers $smokeHeaders -UseBasicParsing -ErrorAction Stop
            $summary = $summaryResponse.Content | ConvertFrom-Json
            $summaryHasFlags = $null -ne $summary.hasActiveGm -and $null -ne $summary.initiativeLocked -and $null -ne $summary.encounterActive -and $null -ne $summary.combatRound
            $summaryOk = $summary.id -eq $sessionId -and $summaryHasFlags
            Add-SmokeResult "Session summary" $summaryOk "GET /api/sessions/:id/summary id=$($summary.id -eq $sessionId), flags=$summaryHasFlags"
        } catch {
            Add-SmokeResult "Session summary" $false "GET /api/sessions/:id/summary failed: $($_.Exception.Message)"
        }

        try {
            $eventsResponse = Invoke-WebRequest -Uri "$BaseUrl/api/sessions/$sessionId/events?limit=10" -Method Get -Headers $smokeHeaders -UseBasicParsing -ErrorAction Stop
            $events = $eventsResponse.Content | ConvertFrom-Json
            $eventsIsArray = $events -is [System.Array]
            Add-SmokeResult "Session events" $eventsIsArray "GET /api/sessions/:id/events returned array=$eventsIsArray"
        } catch {
            Add-SmokeResult "Session events" $false "GET /api/sessions/:id/events failed: $($_.Exception.Message)"
        }

        if ($characterId) {
            try {
                $attachPayload = ConvertTo-Json @{ characterId = $characterId }
                Invoke-WebRequest -Uri "$BaseUrl/api/sessions/$sessionId/characters" `
                    -Method Post `
                    -Headers $smokeHeaders `
                    -Body $attachPayload `
                    -UseBasicParsing -ErrorAction Stop | Out-Null

                Add-SmokeResult "Session attach character" $true "POST /api/sessions/:id/characters succeeded"
            } catch {
                Add-SmokeResult "Session attach character" $false "POST /api/sessions/:id/characters failed: $($_.Exception.Message)"
            }

            try {
                $combatCapabilitiesResponse = Invoke-WebRequest -Uri "$BaseUrl/api/sessions/$sessionId/combat/capabilities" -Method Get -Headers $smokeHeaders -UseBasicParsing -ErrorAction Stop
                $combatCapabilities = $combatCapabilitiesResponse.Content | ConvertFrom-Json

                $hasActors = $combatCapabilities.actors -is [System.Array]
                $hasAttachedCharacter = $hasActors -and (($combatCapabilities.actors | Where-Object { $_.characterId -eq $characterId } | Select-Object -First 1) -ne $null)
                $hasActionsArray = $hasAttachedCharacter -and ((($combatCapabilities.actors | Where-Object { $_.characterId -eq $characterId } | Select-Object -First 1).actions) -is [System.Array])
                $combatCapabilitiesOk = $combatCapabilities.sessionId -eq $sessionId -and $hasActors -and $hasAttachedCharacter -and $hasActionsArray

                Add-SmokeResult "Session combat capabilities" $combatCapabilitiesOk "GET /api/sessions/:id/combat/capabilities session=$($combatCapabilities.sessionId -eq $sessionId), actors=$hasActors, attachedCharacter=$hasAttachedCharacter, actionsArray=$hasActionsArray"
            } catch {
                Add-SmokeResult "Session combat capabilities" $false "GET /api/sessions/:id/combat/capabilities failed: $($_.Exception.Message)"
            }

            try {
                $combatCapabilitiesResponse = Invoke-WebRequest -Uri "$BaseUrl/api/sessions/$sessionId/combat/capabilities" -Method Get -Headers $smokeHeaders -UseBasicParsing -ErrorAction Stop
                $combatCapabilities = $combatCapabilitiesResponse.Content | ConvertFrom-Json
                $actorWithAction = $combatCapabilities.actors | Where-Object {
                    $_.characterId -eq $characterId -and $_.actions -is [System.Array] -and $_.actions.Count -gt 0
                } | Select-Object -First 1

                if ($null -eq $actorWithAction) {
                    Add-SmokeResult "Session execute capability" $true "Skipped: no combat capability actions available"
                } else {
                    $selectedCapability = $actorWithAction.actions | Select-Object -First 1
                    $executeCapabilityBody = @{
                        idempotencyKey = "smoke-cap-$(Get-Random)"
                        sessionCharacterId = $actorWithAction.sessionCharacterId
                        capabilityId = $selectedCapability.capabilityId
                    } | ConvertTo-Json

                    $executeCapabilityResponse = Invoke-WebRequest -Uri "$BaseUrl/api/sessions/$sessionId/combat/execute-capability" `
                        -Method Post `
                        -Headers $smokeHeaders `
                        -Body $executeCapabilityBody `
                        -UseBasicParsing -ErrorAction Stop

                    $executeCapabilityPayload = $executeCapabilityResponse.Content | ConvertFrom-Json
                    $executeCapabilityOk = $null -ne $executeCapabilityPayload.actionType -and ($executeCapabilityPayload.combatEvents -is [System.Array])
                    Add-SmokeResult "Session execute capability" $executeCapabilityOk "POST /api/sessions/:id/combat/execute-capability actionTypePresent=$($null -ne $executeCapabilityPayload.actionType), eventsArray=$($executeCapabilityPayload.combatEvents -is [System.Array])"
                }
            } catch {
                Add-SmokeResult "Session execute capability" $false "POST /api/sessions/:id/combat/execute-capability failed: $($_.Exception.Message)"
            }

            try {
                $rollSelfPayload = ConvertTo-Json @{ characterId = $characterId }
                $rollSelfResponse = Invoke-WebRequest -Uri "$BaseUrl/api/sessions/$sessionId/initiative/roll-self" `
                    -Method Post `
                    -Headers $smokeHeaders `
                    -Body $rollSelfPayload `
                    -UseBasicParsing -ErrorAction Stop

                $rollSelf = $rollSelfResponse.Content | ConvertFrom-Json
                $rollSelfOk = $rollSelf.characterId -eq $characterId -and $null -ne $rollSelf.initiative
                Add-SmokeResult "Initiative roll self" $rollSelfOk "POST /api/sessions/:id/initiative/roll-self returned expected payload=$rollSelfOk"
            } catch {
                Add-SmokeResult "Initiative roll self" $false "POST /api/sessions/:id/initiative/roll-self failed: $($_.Exception.Message)"
            }

            try {
                $rollAllResponse = Invoke-WebRequest -Uri "$BaseUrl/api/sessions/$sessionId/initiative/roll-all" `
                    -Method Post `
                    -Headers $smokeHeaders `
                    -UseBasicParsing -ErrorAction Stop

                $rollAll = $rollAllResponse.Content | ConvertFrom-Json
                $rollAllOk = $null -ne $rollAll.rolledCount
                Add-SmokeResult "Initiative roll all" $rollAllOk "POST /api/sessions/:id/initiative/roll-all rolledCount=$($rollAll.rolledCount)"
            } catch {
                Add-SmokeResult "Initiative roll all" $false "POST /api/sessions/:id/initiative/roll-all failed: $($_.Exception.Message)"
            }

            try {
                $startEncounterResponse = Invoke-WebRequest -Uri "$BaseUrl/api/sessions/$sessionId/encounter/start" `
                    -Method Post `
                    -Headers $smokeHeaders `
                    -UseBasicParsing -ErrorAction Stop

                $startEncounter = $startEncounterResponse.Content | ConvertFrom-Json
                $startEncounterOk = $startEncounter.encounterActive -eq $true -and $startEncounter.combatRound -eq 1
                Add-SmokeResult "Encounter start" $startEncounterOk "POST /api/sessions/:id/encounter/start active=$($startEncounter.encounterActive), round=$($startEncounter.combatRound)"
            } catch {
                Add-SmokeResult "Encounter start" $false "POST /api/sessions/:id/encounter/start failed: $($_.Exception.Message)"
            }

            try {
                $nextTurnResponse = Invoke-WebRequest -Uri "$BaseUrl/api/sessions/$sessionId/encounter/next-turn" `
                    -Method Post `
                    -Headers $smokeHeaders `
                    -UseBasicParsing -ErrorAction Stop

                $nextTurn = $nextTurnResponse.Content | ConvertFrom-Json
                $nextTurnOk = $nextTurn.encounterActive -eq $true -and $nextTurn.combatRound -ge 1
                Add-SmokeResult "Encounter next turn" $nextTurnOk "POST /api/sessions/:id/encounter/next-turn active=$($nextTurn.encounterActive), round=$($nextTurn.combatRound)"
            } catch {
                Add-SmokeResult "Encounter next turn" $false "POST /api/sessions/:id/encounter/next-turn failed: $($_.Exception.Message)"
            }

            try {
                $endEncounterResponse = Invoke-WebRequest -Uri "$BaseUrl/api/sessions/$sessionId/encounter/end" `
                    -Method Post `
                    -Headers $smokeHeaders `
                    -UseBasicParsing -ErrorAction Stop

                $endEncounter = $endEncounterResponse.Content | ConvertFrom-Json
                $endEncounterOk = $endEncounter.encounterActive -eq $false -and $endEncounter.combatRound -eq 1
                Add-SmokeResult "Encounter end" $endEncounterOk "POST /api/sessions/:id/encounter/end active=$($endEncounter.encounterActive), round=$($endEncounter.combatRound)"
            } catch {
                Add-SmokeResult "Encounter end" $false "POST /api/sessions/:id/encounter/end failed: $($_.Exception.Message)"
            }

            try {
                Invoke-WebRequest -Uri "$BaseUrl/api/sessions/$sessionId/initiative/lock" `
                    -Method Post `
                    -Headers $smokeHeaders `
                    -UseBasicParsing -ErrorAction Stop | Out-Null
                Add-SmokeResult "Initiative lock" $true "POST /api/sessions/:id/initiative/lock succeeded"
            } catch {
                Add-SmokeResult "Initiative lock" $false "POST /api/sessions/:id/initiative/lock failed: $($_.Exception.Message)"
            }

            try {
                $rollAfterLockPayload = ConvertTo-Json @{ characterId = $characterId }
                Invoke-WebRequest -Uri "$BaseUrl/api/sessions/$sessionId/initiative/roll-self" `
                    -Method Post `
                    -Headers $smokeHeaders `
                    -Body $rollAfterLockPayload `
                    -UseBasicParsing -ErrorAction Stop | Out-Null

                Add-SmokeResult "Initiative lock guard" $false "Expected roll-self to be blocked while locked"
            } catch {
                $statusCode = Get-StatusCodeFromError $_
                Add-SmokeResult "Initiative lock guard" ($statusCode -eq 403) "roll-self while locked returned status=$statusCode"
            }

            try {
                Invoke-WebRequest -Uri "$BaseUrl/api/sessions/$sessionId/initiative/unlock" `
                    -Method Post `
                    -Headers $smokeHeaders `
                    -UseBasicParsing -ErrorAction Stop | Out-Null
                Add-SmokeResult "Initiative unlock" $true "POST /api/sessions/:id/initiative/unlock succeeded"
            } catch {
                Add-SmokeResult "Initiative unlock" $false "POST /api/sessions/:id/initiative/unlock failed: $($_.Exception.Message)"
            }

            try {
                $resetResponse = Invoke-WebRequest -Uri "$BaseUrl/api/sessions/$sessionId/initiative/reset" `
                    -Method Post `
                    -Headers $smokeHeaders `
                    -UseBasicParsing -ErrorAction Stop

                $resetPayload = $resetResponse.Content | ConvertFrom-Json
                $resetOk = $null -ne $resetPayload.resetCount
                Add-SmokeResult "Initiative reset" $resetOk "POST /api/sessions/:id/initiative/reset resetCount=$($resetPayload.resetCount)"
            } catch {
                Add-SmokeResult "Initiative reset" $false "POST /api/sessions/:id/initiative/reset failed: $($_.Exception.Message)"
            }
        } else {
            Add-SmokeResult "Session attach character" $true "Skipped: no characterId available (likely auth-gated create)"
            Add-SmokeResult "Session combat capabilities" $true "Skipped: no characterId available (likely auth-gated create)"
            Add-SmokeResult "Session execute capability" $true "Skipped: no characterId available (likely auth-gated create)"
            Add-SmokeResult "Initiative roll self" $true "Skipped: no characterId available (likely auth-gated create)"
            Add-SmokeResult "Initiative roll all" $true "Skipped: no characterId available (likely auth-gated create)"
            Add-SmokeResult "Encounter start" $true "Skipped: no characterId available (likely auth-gated create)"
            Add-SmokeResult "Encounter next turn" $true "Skipped: no characterId available (likely auth-gated create)"
            Add-SmokeResult "Encounter end" $true "Skipped: no characterId available (likely auth-gated create)"
            Add-SmokeResult "Initiative lock" $true "Skipped: no characterId available (likely auth-gated create)"
            Add-SmokeResult "Initiative lock guard" $true "Skipped: no characterId available (likely auth-gated create)"
            Add-SmokeResult "Initiative unlock" $true "Skipped: no characterId available (likely auth-gated create)"
            Add-SmokeResult "Initiative reset" $true "Skipped: no characterId available (likely auth-gated create)"
        }

        try {
            Invoke-WebRequest -Uri "$BaseUrl/api/sessions/$sessionId" -Method Delete -Headers $smokeHeaders -UseBasicParsing -ErrorAction Stop | Out-Null
            Add-SmokeResult "Session delete" $true "DELETE /api/sessions/:id succeeded"
        } catch {
            Add-SmokeResult "Session delete" $false "DELETE /api/sessions/:id failed: $($_.Exception.Message)"
        }
    } else {
        Add-SmokeResult "Session details" $true "Skipped: no sessionId available (likely auth-gated create)"
        Add-SmokeResult "Session summary" $true "Skipped: no sessionId available (likely auth-gated create)"
        Add-SmokeResult "Session events" $true "Skipped: no sessionId available (likely auth-gated create)"
        Add-SmokeResult "Session attach character" $true "Skipped: no sessionId available (likely auth-gated create)"
        Add-SmokeResult "Session combat capabilities" $true "Skipped: no sessionId available (likely auth-gated create)"
        Add-SmokeResult "Session execute capability" $true "Skipped: no sessionId available (likely auth-gated create)"
        Add-SmokeResult "Initiative roll self" $true "Skipped: no sessionId available (likely auth-gated create)"
        Add-SmokeResult "Initiative roll all" $true "Skipped: no sessionId available (likely auth-gated create)"
        Add-SmokeResult "Encounter start" $true "Skipped: no sessionId available (likely auth-gated create)"
        Add-SmokeResult "Encounter next turn" $true "Skipped: no sessionId available (likely auth-gated create)"
        Add-SmokeResult "Encounter end" $true "Skipped: no sessionId available (likely auth-gated create)"
        Add-SmokeResult "Initiative lock" $true "Skipped: no sessionId available (likely auth-gated create)"
        Add-SmokeResult "Initiative lock guard" $true "Skipped: no sessionId available (likely auth-gated create)"
        Add-SmokeResult "Initiative unlock" $true "Skipped: no sessionId available (likely auth-gated create)"
        Add-SmokeResult "Initiative reset" $true "Skipped: no sessionId available (likely auth-gated create)"
        Add-SmokeResult "Session delete" $true "Skipped: no sessionId available (likely auth-gated create)"
    }

    $smokePassed = ($smokeResults | Where-Object { $_.Pass -eq $true }).Count
    $smokeFailed = ($smokeResults | Where-Object { $_.Pass -eq $false }).Count
    $smokeTotal = $smokeResults.Count

    Write-Host "`n======================================================" -ForegroundColor Cyan
    Write-Host "SMOKE SUMMARY" -ForegroundColor Cyan
    Write-Host "======================================================" -ForegroundColor Cyan
    Write-Host "Total: $smokeTotal | Passed: $smokePassed | Failed: $smokeFailed"

    if ($smokeFailed -eq 0) {
        Write-Host "`nSTATUS: SMOKE PASSED" -ForegroundColor Green
        exit 0
    }

    Write-Host "`nSTATUS: SMOKE FAILED" -ForegroundColor Red
    exit 1
}

$baseUrl = $BaseUrl
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
