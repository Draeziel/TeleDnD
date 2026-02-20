# RPG Project Execution Plan (Character Assembly → Sheet → Content → Combat)

## Goal

Stabilize the character domain before UI and deep combat work.

Core sequence:

ASSEMBLY → SHEET → CONTENT → COMBAT DEPTH

---

## PHASE 1 — Character Assembly Foundation (Critical)

### Objective
A character is considered **battle-ready** only when fully assembled and validated.

### 1.1 Character Assembly DoD
A character is COMPLETE only if:

- ability scores exist
- effective abilities computed
- skills computed
- saving throws computed
- inventory exists
- equipped loadout valid
- derived stats computed
- capabilities resolved
- unresolvedChoices = 0

This is a **domain contract**, not UI logic.

### 1.2 CharacterAssemblerService
Introduce a single entry point:

assembleCharacter(characterId)

Responsibilities:
- invoke resolver
- aggregate full character state
- validate completeness
- return deterministic structure

### 1.3 Finalize Gate
Draft finalize must do only:

if (!assembly.isComplete) -> reject

All validation lives in assembly layer.

### 1.4 Validation Consolidation
Remove scattered validation from:
- controllers
- UI
- ad-hoc services

Centralize in Assembly layer.

### Phase 1 Result
- Stable, combat-safe character model
- Single source of truth for completeness

---

## PHASE 2 — Character Sheet Domain (NOT UI)

### Objective
Sheet becomes a projection of domain data.

### 2.1 Sheet Contract Freeze (v1)
Define and freeze:

CharacterSheet:
- header
- abilities (base/effective)
- skills
- savingThrows
- derivedStats
- inventory
- equipment
- capabilities
- activeEffects

Changes require versioning.

### 2.2 Sheet Projection Layer
Create:

CharacterSheetProjector

Rules:
- no rule calculation
- transform assembly -> UI shape only

### 2.3 Capability Grouping
Group capabilities into:
- actions
- passives
- reactions
- triggers

### 2.4 Golden Tests
Snapshot tests for:
- Barbarian lvl1
- Bard lvl1

Validate:
- structure stability
- completeness

### Phase 2 Result
UI can be developed safely.

---

## PHASE 3 — Character Sheet UI Overhaul

### Objective
Build playable sheet UI using stable contract.

### 3.1 Layout Structure
Sections:
- Header
- Combat Stats
- Abilities
- Skills
- Actions
- Inventory
- Effects

### 3.2 Reusable Components
Create:
- AbilityBadge
- SkillRow
- ActionCard
- StatusChip
- EquipmentSlot

### 3.3 Zero-Logic Rule
UI must:
- not calculate rules
- not validate domain

### Phase 3 Result
Playable, stable character sheet.

---

## PHASE 4 — Content System

### Objective
Move to data-driven content.

### 4.1 Content Schema Freeze
Define schemas for:
- class
- race
- feature
- action
- item

### 4.2 Import Pipeline
JSON -> importer -> DB

No manual seed-based content.

### 4.3 Vertical Slices (First)
Implement fully:
- Barbarian lvl1–3
- Bard lvl1–3

### 4.4 Item Metadata Expansion
Add:
- damage formula
- attack ability
- armor type
- proficiency requirements

### Phase 4 Result
Content becomes scalable and data-driven.

---

## PHASE 5 — Combat Integration (Deepening)

### Objective
Integrate combat with stable character model.

### 5.1 Turn Resource Model
Introduce resources:
- ACTION
- BONUS
- REACTION
- ATTACK

### 5.2 Action Builder
Flow:
slot -> action -> weapon -> target

### 5.3 Execution Layer
Capability -> ExecutionIntent

Combat must not know rules graph internals.

### 5.4 Automation
Add:
- status ticks
- saves
- automatic damage

### Phase 5 Result
Reliable combat automation.

---

## PHASE 6 — Product Layer / UX Polish

Only after core stability:
- visual effects
- drag & drop interactions
- event playback polish
- QoL automation

---

## Global Rules (Do Not Break)

1. UI never calculates rules.
2. Resolver does not know UI.
3. Combat does not know rules graph internals.
4. Content additions should not require code changes.

---

## Execution Order (Summary)

1. Assembly stabilization
2. Sheet contract freeze
3. Sheet domain layer
4. Sheet UI rewrite
5. Content pipeline
6. Vertical content slices
7. Combat depth
8. Automation polish
