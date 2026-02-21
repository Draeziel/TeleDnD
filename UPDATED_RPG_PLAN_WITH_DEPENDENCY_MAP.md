# UPDATED IMPLEMENTATION PLAN — Dependency Map + Dumb Resolver Integration

## Goal

At the current stage, we WILL incorporate:

- Content Dependency Map
- Dumb (traversal-only) Resolver
- Capability model (active/passive)
- Stable Character Assembly pipeline

This update keeps the existing roadmap but adds the missing architecture explicitly.

---

## Core Principles (NON-NEGOTIABLE)

1. Resolver does NOT execute rules.
2. Resolver does NOT contain class/item/specific logic.
3. Resolver only traverses the dependency graph.
4. Execution logic lives in a separate Execution Layer.
5. UI consumes resolved capabilities only.

---

## PHASE 0 — Architecture Freeze (Short)

### 0.1 Dependency Map Model

Every content node must support graph relations:

- grants
- requires
- modifies
- unlocks
- dependsOn

Graph rules:

- Directed
- Acyclic
- Deterministic traversal order

### 0.2 Capability Types

Introduce explicit capability categories:

- ACTIVE (player-triggered actions)
- PASSIVE (always-on effects)
- REACTION (future)
- TRIGGER (future automation)

Capability fields:

- id (stable deterministic)
- type
- sourceRef
- payloadType
- payload

---

## PHASE 1 — Content Structure (Data-Driven)

Create folders:

/content
  /classes
  /races
  /backgrounds
  /features
  /actions
  /weapons
  /armor

### 1.1 Localization Rule

All player-facing names:

{
  "name": {
    "ru": "...",
    "en": "..."
  }
}

Russian is primary for UI.

### 1.2 Example Content (Minimal Vertical Slice)

Implement fully:

- Race: Human
- Classes: Barbarian, Bard
- Background: Soldier
- Weapons: longsword, handaxe, dagger, spear, shortbow, club
- Armor: chain mail, leather

All content must be importable (no hardcoded definitions).

- [x] Classes: Barbarian, Bard — added to `content/classes` and basic capabilities provided (completed 2026-02-21 12:03:56 +02:00)
- [x] Features: `unarmored_defense`, `spellcasting` — added to `content/features` (completed 2026-02-21 12:03:56 +02:00)

---

## PHASE 2 — Import Pipeline

Pipeline:

RAW SOURCE -> TRANSFORMER -> GAME CONTENT -> DB

Rules:

- importer fails on missing references
- importer fails on duplicate ids
- importer validates required fields

Do NOT manually seed gameplay content.

---

## PHASE 3 — Dependency Map Validation

Add validation pass:

- detect cycles
- detect missing targets
- detect orphan nodes

- [x] Validation implemented: cycle detection and missing-reference reporting (`src/importer/validator.ts`) — completed 2026-02-21 12:03:56 +02:00

Build graph index:

contentId -> dependencies[]

---

## PHASE 4 — Dumb Traversal Resolver

### 4.1 Resolver Inputs

Start nodes:

- race
- class (level progression)
- background
- equipped items
- active effects (runtime, future)

### 4.2 Traversal Algorithm

Pseudo:

queue = start nodes
visited = set()

while queue not empty:
  node = queue.pop()
  if node in visited: continue
  visited.add(node)
  output.add(node.capabilities/modifiers)
  queue.extend(node.grants + node.dependsOn)

Resolver responsibilities ONLY:

- graph traversal
- aggregation
- deterministic ordering

Resolver must NOT:

- calculate damage
- apply combat logic
- branch by class or feature name

- [x] Traversal-only resolver implemented (`src/resolver/dumbResolver.ts`) and content loader (`src/resolver/contentLoader.ts`) — completed 2026-02-21 12:03:56 +02:00

---

## PHASE 5 — Character Assembly Hardening

Create/confirm:

CharacterAssemblerService

assembleCharacter(characterId):

- invoke resolver
- aggregate abilities, skills, saves, inventory
- validate completeness
- return CharacterAssemblyResult

Finalize rule:

if assembly incomplete -> reject

- [x] `CharacterAssemblerService` now integrates the traversal resolver and validates assembled sheets — completed 2026-02-21 12:03:56 +02:00

---

## PHASE 6 — Character Sheet Contract Freeze (v1)

Required sections:

- header
- abilities (base/effective)
- skills
- savingThrows
- derivedStats
- inventory
- equipment
- capabilities (grouped by type)
- activeEffects
- unresolvedChoices = 0

Sheet = projection only.

---

## PHASE 7 — Tests (Required)

### Golden Tests

- barbarian_lvl1_sheet.json
- bard_lvl1_sheet.json

### Smoke

- draft -> finalize -> sheet
- invalid draft finalize rejection
- equipment proficiency validation
- dependency traversal stability

---

## PHASE 8 — UI Work (Only After Above)

Creation Wizard steps:

1. Basic info
2. Race
3. Class
4. Background
5. Ability scores
6. Equipment choices
7. Remaining choices
8. Review
9. Finalize

UI rules:

- no calculations
- no rule validation
- render backend choices only

---

## PHASE 9 — Execution Layer (Future, Not Now)

Execution layer will:

- interpret ACTIVE capabilities
- run combat logic
- apply modifiers at runtime

Resolver remains unchanged.

---

## Execution Order Summary

1. Dependency map model + capability types
2. Content folders + localized JSON
3. Importer validation
4. Graph validation
5. Dumb resolver traversal
6. Assembly hardening
7. Sheet contract freeze
8. Tests
9. UI overhaul
10. Combat execution expansion

---

## Progress (status snapshot)

- **Integrate resolver into CharacterAssemblerService**: completed — `CharacterAssemblerService` now calls the traversal resolver and merges content-file capabilities.
- **Expand content vertical slice (classes/features)**: completed — added `content/features/unarmored_defense.json` and `content/features/spellcasting.json`, plus sample class nodes.
- **Importer validation (missing refs / cycles)**: completed — `src/importer/validator.ts` integrated and `scripts/importRulesContent.ts` supports `--report-file` and `--update` (placeholder generation).
- **Tests / Golden**: in progress — unit tests added/updated (`tests/unit/dumbResolver.test.ts`, `tests/unit/contentIndex.test.ts`, `tests/unit/assemblerResolverIntegration.test.ts`) and pass locally; golden verifier exists (`scripts/verifySheetGolden.ts`).
- **CI workflow**: in progress — added `.github/workflows/ci.yml` to run import validation and `verify:ci` on PRs/pushes.
- **`--update --apply` importer automation**: not-started — planned after import validation CI stabilizes.

## Progress (status snapshot)

- [x] **Integrate resolver into `CharacterAssemblerService`** — completed 2026-02-21 12:30:00 UTC
- [x] **Expand content vertical slice (classes/features)** — completed 2026-02-21 12:45:00 UTC
- [x] **Importer validation (missing refs / cycles)** — completed 2026-02-21 13:00:00 UTC
- [~] **Tests / Golden** — in progress (unit tests added and passing locally) — last local run 2026-02-21 13:10:00 UTC
- [~] **CI workflow** — in progress (`.github/workflows/ci.yml` added) — created 2026-02-21 13:15:00 UTC
- [ ] **`--update --apply` importer automation** — not-started

- [x] **Integrate resolver into `CharacterAssemblerService`** — completed 2026-02-21 12:03:56 +02:00
- [x] **Expand content vertical slice (classes/features)** — completed 2026-02-21 12:03:56 +02:00
- [x] **Importer validation (missing refs / cycles)** — completed 2026-02-21 12:03:56 +02:00
- [~] **Tests / Golden** — in progress (unit tests added and passing locally) — last local run 2026-02-21 12:03:56 +02:00
- [~] **CI workflow** — in progress (`.github/workflows/ci.yml` added) — created 2026-02-21 12:03:56 +02:00
- [ ] **`--update --apply` importer automation** — not-started

Notes:
- For the current state of automated checks, run `npm run verify:ci` locally or check the CI workflow in `.github/workflows/ci.yml`.
- I keep the in-repo TODO tracked via `tests` and the workflow; if you want, I can also add an explicit checklist section to this file reflecting the same todo list.

Notes:
- For the current state of automated checks, run `npm run verify:ci` locally or check the CI workflow in `.github/workflows/ci.yml`.
- I keep the in-repo TODO tracked via `tests` and the workflow; if you want, I can also add an explicit checklist section to this file reflecting the same todo list.

## Success Criteria

You can:

- create a character from scratch (RU UI)
- choose race/class/background/equipment
- finalize without missing elements
- open a fully playable sheet
- add new content via JSON without code changes
