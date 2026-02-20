## Execution Addendum (Required Before Implementation)

### 1. Acceptance Criteria & Test Coverage

CharacterSheet v1 MUST always contain:

- header
- abilities.base
- abilities.effective
- skills[]
- savingThrows[]
- derivedStats
- inventory[]
- equipment/loadout
- capabilities[]
- unresolvedChoices = 0

Required tests:

Golden tests:
- barbarian_lvl1_sheet.json
- bard_lvl1_sheet.json

Smoke tests:
- full draft → finalize → sheet assembly
- invalid draft finalize rejection
- equipment validation

DoD is reached only if all tests pass.

---

### 2. Migration & Compatibility Strategy

Rules:

- Existing characters MUST remain loadable after schema changes.
- Sheet versioning required:
  - characterSheetVersion field.
- Adapter layer allowed during migrations.
- Never delete legacy fields without migration path.

Fallback:

- If assembly fails → return explicit assembly error (no partial sheet).

---

### 3. Owners & Timeline (Estimated)

Phase 1 — Assembly Foundation
Owner: Backend
Estimate: 1 sprint

Phase 2 — Sheet Domain
Owner: Backend
Estimate: 1 sprint

Phase 3 — Sheet UI Overhaul
Owner: Frontend
Estimate: 1–2 sprints

Phase 4 — Content System
Owner: Backend + Content
Estimate: 2 sprints

Phase 5 — Combat Integration
Owner: Backend
Estimate: 1–2 sprints

---

### 4. Iteration 1 Backlog (Immediate Tasks)

- Create CharacterAssemblerService
- Implement assembly completeness validation
- Move finalize validation into assembly layer
- Add unit tests for assembler
- Add integration test: draft → finalize → sheet
- Create golden fixtures for lvl1 Barbarian and Bard
- Add sheet contract validation test
