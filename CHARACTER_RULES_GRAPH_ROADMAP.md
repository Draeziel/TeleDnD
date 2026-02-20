# Character Rules Graph Overhaul Roadmap

**Last Updated**: 2026-02-20  
**Status**: Planned, execution-ready  
**Scope**: Backend/domain architecture and data pipeline only (no UI redesign in this stream)

---

## 1) Objective

Build a single source of truth RPG Rules Graph so character creation, character sheet computation, and future combat automation use the same rule data.

Target outcomes:
- One unified rules graph in DB.
- Deterministic capability resolution for character runtime.
- Import-driven content flow (JSON -> importer -> DB), not manual seed-first logic.
- Backward-compatible migration path for existing characters/drafts.

---

## 2) Non-goals (for this stream)

- UI redesign in miniapp pages.
- New combat UX features.
- Full spellcasting implementation (Spell is placeholder schema + import contract only).

---

## 3) Architecture baseline

Rules Graph (conceptual):

Class
-> ClassLevelProgression
-> Feature
-> Action / Modifier / Choice

Race
-> Feature

Item
-> Action / Modifier

Spell
-> placeholder node for future ability/action linkage

Hard rule:
- UI and sheet endpoints consume resolved capabilities contract, not class/race-specific conditional logic.
- Architecture line is reserved as: Rules Graph -> Resolver -> Capability -> Execution.

---

## 4) Required model set

Core models (create/refactor):
- ContentSource
- Class
- Race
- ClassLevelProgression (classId, level, featureId)
- Feature (rule container)
- Action (active gameplay capability)
- Modifier (extend current model if required)
- Choice (unified choice definition)
- Item (extend combat metadata)
- Spell (placeholder only)

Supporting fields:
- rulesVersion on content packages and resolvable entities.
- sourceRef metadata for traceability (which node generated a capability).

---

## 5) Capability Resolver contract

Service:
- Character -> resolveCapabilities(characterId | draftId)

Stable output DTO:
- actions[]
- passiveFeatures[]
- modifiers[]
- choicesRemaining[]
- metadata: rulesVersion, computedAt, sourceGraphDigest

Determinism requirements:
- deterministic ordering
- conflict policy for stacking/overrides
- explicit priority semantics for modifiers with fixed operation modes only: `add | set | override | multiply`

### Capability model (explicit)

Capability is a resolved, executable/readable unit produced from rules graph.

Capability categories:
- `ACTION` (active, user-initiated)
- `PASSIVE` (always-on feature)
- `MODIFIER` (numeric/stat transform)
- `CHOICE` (pending or resolved decision point)

Required fields (minimum contract):
- `id` (stable deterministic key)
- `type` (`ACTION | PASSIVE | MODIFIER | CHOICE`)
- `sourceType` (`class | race | feature | item | spell | system`)
- `sourceId`
- `scope` (`sheet | combat | exploration | social | universal`)
- `timing` (`static | runtime`)
- `rulesVersion`
- `payloadType` (required discriminator)
- `payload` (typed strictly by payloadType)
- `executionIntent` (future placeholder; no runtime implementation in this stream)

Design rule:
- UI consumes capabilities only; no class/race-specific branches.

---

## 5.1) Trigger model (explicit)

Introduce trigger metadata for runtime-capable rules:

Trigger shape:
- `phase`: `on_apply | turn_start | turn_end | on_hit | on_damage | on_save | manual`
- `condition`: expression/criteria object (future-safe)
- `targeting`: `self | ally | enemy | area | explicit`
- `cooldown` (optional)
- `stackPolicy`: `refresh | stack | ignore | replace`

Usage:
- `ACTION` and runtime `PASSIVE` capabilities may include trigger blocks.
- Trigger model is stored in graph payload and interpreted by runtime engines.

Non-goal in current stream:
- full combat trigger executor; only model + resolver exposure contract.

---

## 5.2) Static vs Runtime distinction

All resolved capabilities must be explicitly marked as static or runtime.

Static:
- deterministic sheet-time values (bonuses, proficiencies, passive grants)
- no temporal/session state required

Runtime:
- requires encounter/session context or event processing
- examples: start-of-turn effects, reaction windows, conditional temporary modifiers

Contract requirement:
- sheet service consumes `static` directly
- runtime engines consume `runtime` via trigger metadata
- no ambiguous capabilities without timing classification

---

## 6) Migration and compatibility strategy (mandatory gate)

Before schema refactor rollout:
- Define compatibility layer for existing character sheet API.
- Introduce adapter path so legacy sheet endpoints read from new resolver output.
- Keep old data path behind fallback flag until parity tests pass.

Data migration principles:
- idempotent migrations only
- no destructive drop before parity validation
- clear rollback steps for each migration phase

---

## 7) Unified choice engine

Rules:
- choices are generated from feature graph, not UI assumptions
- chooseCount enforcement
- required vs optional behavior
- source tracking and provenance
- all validation belongs to draft/domain engine

---

## 8) Content import pipeline

Folder strategy:
- /content/classes
- /content/races
- /content/items
- /content/features
- /content/spells (placeholder)

Pipeline:
- JSON schema validation -> normalization -> transactional import -> report

Importer requirements:
- dry-run mode
- idempotency by stable external IDs
- clear error report (path, rule, reason)
- partial-failure guard (transaction boundaries)

---

## 9) Item combat metadata

Extend item model with:
- weaponCategory
- attackAbility
- damageFormula
- proficiencyRequirements
- armorType

Used by future capability-to-combat action bridge.

---

## 10) Phased implementation plan

### Phase 0: ADR and contracts
- Author architecture decision record for rules graph.
- Freeze resolver DTO contract and modifier conflict policy.
- Freeze capability model contract (`ACTION/PASSIVE/MODIFIER/CHOICE`) and trigger shape.
- Freeze static/runtime classification rules and validation.
- Define migration and rollback strategy.
- ADR-0001 accepted: [docs/adr/0001-rules-graph-capability-contract.md](docs/adr/0001-rules-graph-capability-contract.md)

### Phase 1: Schema foundation
- Add/extend Prisma models and relations for graph.
- Add rulesVersion + provenance fields.
- Prepare non-destructive migrations.

### Phase 2: Resolver v1
- Implement resolveCapabilities service.
- Add unit tests and golden snapshots for deterministic output.
- Add adapter from resolver to current sheet payload contract.
- Ensure resolver emits timing classification and trigger blocks where applicable.

### Phase 3: Progression and choices
- Move class feature loading to ClassLevelProgression.
- Refactor draft choice generation to feature-driven engine.
- Enforce validations in domain layer only.

### Phase 4: Import pipeline
- Build JSON importer with dry-run and idempotency.
- Seed demo content through importer (Barbarian + Bard).
- Keep old seed path as fallback until parity approved.

### Phase 5: Cutover
- Switch sheet service to resolver-first path.
- Remove legacy class/race conditional branches in sheet domain logic.
- Keep compatibility fallback behind env flag for one release window.

---

## 11) Definition of Done

Required for stream closure:
- Prisma schema with rules graph models and migrations applied cleanly.
- Resolver returns stable DTO with deterministic output.
- Capability model + trigger model are documented and enforced by schema/validation.
- Static vs runtime capability distinction is explicit and covered by tests.
- `payloadType` is mandatory for every capability payload.
- Modifier operations are validated against fixed modes: `add | set | override | multiply`.
- Character sheet built from resolver capabilities path.
- Feature/choice/progression behavior verified by tests.
- Importer is primary content ingestion path for demo pack.
- README documents rules graph and importer workflow.
- No class/race hardcoded rule branches in sheet domain service.

---

## 12) Risks and controls

Top risks:
- schema drift during migration
- resolver parity regressions vs old sheet output
- inconsistent content imports

Controls:
- migration precheck + rollback scripts
- golden-sheet snapshot tests (old vs new parity)
- importer dry-run in CI before apply

---

## 13) Immediate execution tasks (next 1-2 days)

1. ADR accepted: [docs/adr/0001-rules-graph-capability-contract.md](docs/adr/0001-rules-graph-capability-contract.md).
2. Define resolver DTO types in backend and miniapp shared contracts (including capability type + timing + trigger block + payloadType + executionIntent).
3. Draft Prisma model diff for progression/action/spell/item metadata.
4. Prepare first non-destructive migration.
5. Add initial golden test fixtures (Barbarian level 1, Bard level 1).
