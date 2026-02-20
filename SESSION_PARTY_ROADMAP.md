# Session / Party System Roadmap

**Last Updated**: 2026-02-20  
**Status**: Phase 1 implemented and stabilized for production MVP; combat automation foundation and MVP status automation are live

---

## How to use this file

- Mark tasks as `[x]` when fully done.
- Keep partially done tasks as `[~]` (in progress).
- Add short notes in the **Execution Log** section after each completed chunk.
- If scope changes, update **Decisions / Constraints** first, then task lists.

Legend:
- `[ ]` not started
- `[~]` in progress
- `[x]` completed

---

## Scope (Phase 1)

Build a multiplayer session (party) system where:
- players and GM can gather in a shared session,
- combat/live state is session-scoped,
- base character data remains immutable from session actions,
- permissions are enforced by ownership and GM role.

---

## Decisions / Constraints

1. Combat state must be session-scoped (`SessionCharacterState`, `SessionEffect`), not on base `Character`.
2. Joining is done via `joinCode` (not by exposing predictable IDs).
3. Ownership is required: `Character.ownerUserId` must reference `User`.
4. GM-only actions: set HP, set initiative, apply effect.
5. Must include uniqueness/index constraints:
   - unique `(sessionId, userId)` in `SessionPlayer`
   - unique `(sessionId, characterId)` in `SessionCharacter`
   - unique index for `Session.joinCode`
6. Leave policy for GM must be explicit:
   - GM can leave without transfer,
   - session remains active even if no GM is currently present.
7. Validation rules:
   - `currentHp >= 0`
   - `tempHp >= 0`
   - initiative in safe range (e.g. `-20..99`)
8. Add `updatedAt` to mutable session-state entities for polling/debug.
9. Keep creator identity on session as `createdByUserId` for ownership/audit/GM transfer support.
10. Capture HP baseline on attach via `SessionCharacterState.maxHpSnapshot` to avoid HP drift when base character changes outside session.

---

## Phase 1 Backlog

### A) Data model & migrations

- [x] Add `User` model (`id`, `telegramId` unique, timestamps)
- [x] Add `ownerUserId` to `Character` + relation to `User`
- [x] Add `Session` model (`id`, `name`, `gmUserId`, `createdByUserId`, `joinCode`, timestamps)
- [x] Add `SessionPlayer` model (`sessionId`, `userId`, `role`, timestamps)
- [x] Add `SessionCharacter` model (`sessionId`, `characterId`, timestamps)
- [x] Add `SessionCharacterState` model (`currentHp`, `maxHpSnapshot`, `tempHp`, `initiative`, `notes`, `updatedAt`)
- [x] Add `SessionEffect` model (`effectType`, `duration`, `payload`, `updatedAt`)
- [x] Add unique constraints and required indexes
- [~] Create and apply Prisma migration
- [x] Regenerate Prisma client

### B) Backend auth context & permissions

- [x] Ensure request user context includes `userId` (from Telegram initData)
- [x] Add permission helper: `isSessionGM(sessionId, userId)`
- [x] Add permission helper: `isCharacterOwner(characterId, userId)`
- [x] Add guard for GM-only endpoints
- [x] Add guard for attach-own-character rule
- [x] Implement explicit GM leave policy

### C) Session API endpoints

- [x] `POST /api/sessions` (creator becomes GM + SessionPlayer)
- [x] `GET /api/sessions` (sessions where current user is member)
- [x] `POST /api/sessions/join` by `joinCode`
- [x] `POST /api/sessions/:id/leave`
- [x] `GET /api/sessions/:id` (players + characters + states + effects summary)
- [x] `GET /api/sessions/:id/summary` for lightweight polling
- [x] `GET /api/sessions/:id/events` for lightweight event feed
- [x] `POST /api/sessions/:id/initiative/lock|unlock|reset`

### D) Character assignment endpoints

- [x] `POST /api/sessions/:id/characters` (owner-only)
- [x] `DELETE /api/sessions/:id/characters/:characterId`
- [x] Auto-create `SessionCharacterState` on first attach

### E) GM gameplay endpoints

- [x] `POST /api/sessions/:sessionId/characters/:characterId/set-hp`
- [x] `POST /api/sessions/:sessionId/characters/:characterId/set-initiative`
- [x] `POST /api/sessions/:sessionId/characters/:characterId/apply-effect`
- [x] Validate payloads and ranges

### F) Frontend (miniapp)

- [x] Add `SessionsPage` (list, create, join by code)
- [x] Add `SessionViewPage` (party list, HP, initiative, effects)
- [x] Add GM-only controls in session view
- [x] Add polling refresh every 5–10 seconds
- [x] Add attach-character action from Character Sheet and/or Session View
- [x] Add API client methods for new session endpoints

### G) Docs & ops

- [x] Update `README.md` with session model and endpoint docs
- [x] Update `PROJECT_SNAPSHOT.md` with phase progress
- [x] Add smoke checks for session endpoints
- [x] Verify `npm run build` (backend + miniapp)

### J) Session UX & observability refinement

- [x] Show explicit “no active GM” state in session view
- [x] Disable GM controls when session has no active GM
- [x] Show actor-aware removal messages in UI
- [x] Add session event journal (join/leave/remove/HP/init/effects) with persistent DB storage

### I) Combat initiative automation

- [x] GM button: roll initiative for all session characters (server-side d20 + DEX mod)
- [x] Player button: roll own initiative for owned attached character
- [x] Initiative roll audit log (who rolled, when, value)
- [x] Optional lock/reset policy for re-rolls per encounter

### H) Ownership hardening (post-Phase1 refinement)

- [x] Filter character list by current Telegram user ownership
- [x] Restrict character read/delete/sheet access to owner
- [x] Ensure draft finalize assigns `ownerUserId`
- [x] Add miniapp character delete action in list view

---

## Definition of Done (Phase 1)

- User can create and join sessions using `joinCode`.
- User sees only sessions they belong to.
- User can attach only own characters.
- GM can update HP/initiative and apply effects.
- Session actions do not mutate base character model data.
- Session view updates via polling and displays current live state.
- Docs and smoke checks are updated.
- Session records creator (`createdByUserId`) and character state includes `maxHpSnapshot`.

---

## Execution Log

- 2026-02-17: Roadmap file created and approved as tracking source.
- 2026-02-17: Added production refinements: `createdByUserId`, `maxHpSnapshot`, and future `/sessions/:id/summary` note.
- 2026-02-17: Implemented Prisma schema changes for User/Session/State models + manual migration SQL `20260217235000_add_session_party_models` + Prisma client generation.
- 2026-02-17: `prisma migrate dev` blocked by local migration drift in previously applied migration; migration apply remains pending on clean/production migration flow.
- 2026-02-17: Implemented first Session API slice (`POST /api/sessions`, `GET /api/sessions`, `POST /api/sessions/join`, `POST /api/sessions/:id/leave`, `GET /api/sessions/:id`) and wired routes under Telegram auth middleware.
- 2026-02-17: Implemented session character assignment and GM gameplay actions with permission checks and validation (`attach/remove`, `set-hp`, `set-initiative`, `apply-effect`).
- 2026-02-17: Implemented miniapp sessions frontend (`SessionsPage`, `SessionViewPage`, polling, session API client) and wired routes/navigation.
- 2026-02-17: Implemented character delete API + miniapp delete button in character list.
- 2026-02-17: Implemented ownership hardening for character endpoints and fixed draft finalize ownership regression (`ownerUserId` is now set on created characters).
- 2026-02-17: Added session deletion flow (GM-only) and reduced session view flicker with silent polling refresh.
- 2026-02-17: Added initiative order block in session view (sorted descending by initiative).
- 2026-02-17: Initiative dice automation explicitly deferred and tracked in roadmap for a later phase.
- 2026-02-17: Updated GM leave policy: GM can leave without transfer; session remains without active GM.
- 2026-02-17: Implemented `GET /api/sessions/:id/summary` and switched session polling to summary payload.
- 2026-02-17: Added lightweight session event journal and no-GM UX handling (banner + GM control lock).
- 2026-02-17: Added GM activity status to session list UI (`active / no active GM`) using `hasActiveGm` in `GET /api/sessions`.
- 2026-02-17: Changes pushed and deployment triggered (`3e4dbcc`, `dac563b`).
- 2026-02-17: Added `GET /api/sessions/:id/events` endpoint and API client method for standalone event feed.
- 2026-02-17: Expanded smoke tests with session summary/events checks and initiative roll checks (`roll-self`, `roll-all`).
- 2026-02-17: Implemented initiative roll automation endpoints and miniapp controls (GM all + player self).
- 2026-02-17: Replaced in-memory event journal with persistent `session_events` storage and added migration `20260217215500_add_session_events_and_initiative_lock`.
- 2026-02-17: Implemented initiative lock/unlock/reset flow (backend endpoints + miniapp controls).
- 2026-02-17: Smoke scripts now support real Telegram `initData` via `-TelegramInitData`.
- 2026-02-17: Local migration state recovered via `prisma migrate resolve --rolled-back` and successfully applied with `prisma migrate deploy`.
- 2026-02-17: Added GitHub Actions CI gate (`.github/workflows/ci.yml`) with Postgres service, backend+miniapp build, and smoke suite run.
- 2026-02-17: Added response metadata middleware to include `requestId` in JSON object responses.
- 2026-02-17: Upgraded probes with richer `/healthz` payload and new `/readyz` endpoint with DB readiness check.
- 2026-02-17: Added encounter turn flow (`/encounter/start`, `/encounter/next-turn`, `/encounter/end`) with active turn tracking and round progression; miniapp now shows current turn and encounter controls.
- 2026-02-17: Improved combat UX in session view: compact combat bar with current/next turn indicators and quick `Next turn` action.
- 2026-02-17: Polished session visual style: unified button variants (primary/secondary/danger) and improved mobile layout for toolbar/cards/actions.
- 2026-02-17: Made session header controls contextual: tap session name to refresh, tap join code to copy, tap initiative status to toggle lock/unlock, and start/stop round via icon near round number.
- 2026-02-17: Replaced contextual text links with compact inline buttons in session header/combat block for cleaner, more consistent visual UX.

---

## Next Sprint (proposed)

1. Stabilize production behavior with quick smoke checks after deploy (health + auth-gated session endpoints).
2. Decide whether to keep events in summary payload or switch UI polling fully to `/events` endpoint.
3. Add event retention policy (TTL/archival) for `session_events` growth control.
4. Evaluate optional explicit GM reassignment action while keeping no-transfer leave policy.

---

## Companion-grade milestones (P0/P1/P2)

### P0 — Production reliability baseline

- [x] Enforce strict Telegram auth in production paths (remove fallback behavior outside dev/test).
- [x] Add structured request logging with correlation/request IDs.
- [x] Add error-rate and latency alerting for backend (Render + external monitor integration).
- [x] Define and track basic SLOs (availability, p95 latency, 5xx budget).
- [x] Add CI gate for backend build + miniapp build + smoke checks.

### P1 — Gameplay and UX robustness

- [x] Add encounter flow primitives: start encounter, active turn marker, next turn, finish encounter.
- [x] Add safe “undo last combat action” for GM (HP/initiative/effect mutations).
- [x] Add network resilience UX in miniapp (retry/backoff and clearer offline recovery).
- [ ] Improve small-screen ergonomics (tap targets, dense combat layout, minimal scroll friction).
- [x] Define and implement retention policy for `session_events` (TTL/archive + cleanup task).

### P1.5 — Monster Catalog & GM Toolkit (new)

- [x] Add monster template catalog model with scopes:
   - `GLOBAL` templates (visible to all users; admin-managed only)
   - `PERSONAL` templates (visible/editable only by owner user)
- [x] Add admin authorization policy for global catalog management (Telegram ID allowlist).
- [x] Add session combatant support for monsters with quantity add (`N` instances in one action).
- [x] Add API endpoints for:
   - list/search monster templates (`global + personal` projection)
   - create personal monster template (GM/user)
   - create global monster template (admin only)
   - update/delete monster template with scope-based permissions (global: admin only, personal: owner only)
   - add monsters to session by template + quantity
- [x] Add miniapp “GM Toolkit” section in main navigation:
   - `Персонажи` (player tools)
   - `Монстры` (GM tools; extensible for future sections)
- [x] Add minimal UI flow in session view for quick monster add:
   - select template
   - set quantity
   - submit in one compact action

### P1.6 — Session UX / Combat UX v2 (new)

- [x] B1: Session list and session header minimization
   - remove session-name max length restriction in UI/API validation
   - compact session header with role + players icons
   - hide non-critical counters/status labels from header
- [x] B2: Pre-combat character board (3-column tiles)
   - show only avatar, HP heart, AC shield, status icons
   - grayscale tile when HP is 0
   - open full character card on tile click
- [x] B3: Combat block separation and initiative flow
   - separate "Start combat" block when encounter not active
   - lock icon instead of initiative text status
   - add monster initiative roll action
   - build encounter queue row with active-turn highlight and force-next-turn
   - disallow repeated player self-roll after first roll within encounter
- [x] B4: In-combat HP/status interaction panel (GM-only edits)
   - tap heart opens HP/status panel
   - HP and status modifications restricted to GM
   - manual status removal before expiration
- [x] B5: Visibility and attach-flow tightening
   - events journal visible to GM only, behind explicit toggle
   - attach-character section hidden by default behind "+персонаж"
   - enforce 1 character per player; GM unlimited

### P1.7 — Status rule templates (new)

- [x] Add status template catalog model (GM-configurable presets with trigger/duration rules).
- [x] Add dice-based damage config for templates (e.g., `1d6`, `2d4+1`).
- [x] Add save config in template (`die`, `threshold`, `ability`, `half/full/none on success`).
- [ ] Persist rule snapshot to applied session effect at apply time (immutability for existing effects).
- [~] Extend GM Toolkit miniapp with simple status-template editor and picker.
- [ ] Add combat log payload fields for rolled dice and save breakdown from template rules.
- [ ] Combat journal readability pass (deferred): in combat-phase journal show only participant interactions (damage/effects/actions), hide technical system lines like turn-advance and round counters.

### P2 — Companion product depth

- [ ] Add session-level resource tracking (consumables/charges/conditions).
- [ ] Introduce gameplay analytics baseline (DAU, session duration, encounter completion, retention).
- [ ] Add optional GM handover workflow while preserving no-transfer leave default.
- [ ] Expand content-source tooling for scalable rule/content packs.
- [ ] Add in-app onboarding checklist for first session run.
- [ ] Add bulk import/sync tooling for global monster bestiary maintenance.

### TD1 — Tech debt return (agreed, high priority)

- [x] Status template editor: add short badge label field (e.g., `ЯД`) and persist it in template payload/meta.
- [x] Combat journal filter pass: show only participant interactions (damage, apply/remove effect, reaction results), hide system/flow lines (`turn advanced`, `round counter`, etc.) in combat-phase log.
- [x] Effect immutability: persist full template-rule snapshot into applied effect payload at apply time, so later template edits do not retroactively change active effects.
- [x] SessionView refactor: split large combat page logic into focused components/hooks to reduce regression risk and improve maintainability.
- [x] Combat/status automation tests: cover save ability selection, dice rolls, damage percent mapping, rounds decrement/expiry, and event payload shape.
- [x] CSS cleanup: remove/merge stale card/status styles left after combat card redesign to keep UI layer predictable.

---

## Open Questions

- Should we allow explicit “assign new GM” action in Phase 2 while keeping current leave policy?
- Should players be allowed to detach characters attached by GM?
- Do we need soft-delete/audit trail for session events in Phase 1 or later?
- Should `/api/sessions/:id/summary` ship in late Phase 1 or move to Phase 2 optimization?
- Should personal monster templates be editable by non-GM users or GM-only for v1?

---

## Planning Update (2026-02-19)

- Checked roadmap alignment for requested monster features.
- Added explicit implementation plan for:
   - global admin-managed monster catalog,
   - personal user-managed monster catalog,
   - GM toolkit navigation entry in miniapp,
   - quantity-based monster add into sessions.
- Implemented MVP slice:
   - Prisma models/migration for `monster_templates` and `session_monsters`,
   - `/api/monsters/templates` list/create,
   - `/api/sessions/:id/monsters` quantity add,
   - miniapp `Монстры` page and compact add-monsters flow in session view.
- Extended monster template fields to stat-block format (type/alignment/speed/abilities/immunities/traits/actions/legendary actions) plus icon/image slots; split monster creation/view areas and added `Мои/Глобальные` tabs with card-style preview.
- 2026-02-19: Hardened Telegram auth policy (strict in production), added in-memory request metrics endpoint (`/metricsz`), and aligned roadmap statuses for CI gate, session events retention, and monster template update/delete APIs.
- 2026-02-19: Added SLO smoke baseline (`MaxErrorRatePct`, `MaxSlowRatePct` in smoke scripts), switched Render health check to `/readyz`, and documented operational probe/metrics verification flow.
- 2026-02-19: Added scheduled production monitor workflow (`.github/workflows/production-monitor.yml`) with probes + SLO smoke checks every 30 minutes and manual dispatch inputs.
- 2026-02-19: Added scoped Session UX / Combat UX v2 roadmap block (P1.6) and started B1/B5 implementation slice.
- 2026-02-19: Implemented B1 and partial B2/B5: removed session-name max length limit, compacted session header, added pre-combat character tile board with HP/AC/statuses and tap-to-open detailed card, moved events/attach behind toggles with GM-only journal visibility and player attach limit.
- 2026-02-19: Reworked combat entry flow: `Начать бой!` opens dedicated combat interface that hides non-combat blocks; encounter starts from `Начать сражение` inside combat block.
- 2026-02-19: Refined combat UI: compact round label (`Р:x`), renamed controls (`Завершить бой`, `Начать сражение`), compact turn-pass icon button, GM-only monster-add controls, and actor differentiation via background+badge.
- 2026-02-19: Added pre-start unified actors board (characters + monsters) with 3-column cards and removal actions; added backend+API support for removing session monsters (`DELETE /api/sessions/:id/monsters/:monsterId`).
- 2026-02-19: During active encounter hidden `Монстры в сессии`; `Порядок ходов` switched to 3-column participant-style cards; fixed monster template stat loss on summary polling by normalizing summary monster shape (`template`).
- 2026-02-19: Documentation synchronized after Combat UX v2 updates (`PROJECT_SNAPSHOT.md` + roadmap statuses/log).
- 2026-02-20: Added GM split initiative actions (`🎲🧑`, `🎲👾`) and monster HP edit endpoint/UI (`POST /api/sessions/:sessionId/monsters/:monsterId/set-hp`).
- 2026-02-20: Implemented safe combat undo for GM (`POST /api/sessions/:id/combat/undo-last`) with rollback for HP/initiative/effect and hidden internal undo snapshots.
- 2026-02-20: Fixed active-turn model for monsters in encounter queue, added explicit active card highlight, and blocked repeated player self-roll during active encounter.
- 2026-02-20: Implemented network resilience in miniapp session view (GET retry with backoff+jitter, offline/reconnecting banners, adaptive polling backoff, online/offline recovery hooks).
- 2026-02-20: Reworked in-combat heart interaction to GM popup editor (no card height expansion), added sync-age chip in session header, and introduced status presets + color-coded status dots (`poisoned/cursed/stunned`).
- 2026-02-20: Removed sync-age chip from session header as noisy UX, while preserving silent polling and reconnect handling.
- 2026-02-20: Added monster status workflow parity (apply/render/effects count + undo support), plus status dots on character and monster combat cards.
- 2026-02-20: Implemented combat automation foundation: event cursor sequencing (`eventSeq`), persisted combat snapshot endpoint, idempotent `POST /combat/action`, and persisted reaction windows with deadlines.
- 2026-02-20: Switched miniapp polling to cursor-aware merge (`after=eventSeq`) and combat-summary merge for active encounter.
- 2026-02-20: Added dual combat API modes (`action/auto/legacy`) with strict default `action` and GM-visible mode badge in session header.
- 2026-02-20: Fixed Render deploy blocker (`P3009`) caused by migration SQL index column mismatch and added safe auto-recovery in `render.yaml` start command.
- 2026-02-20: Added MVP poison auto-tick on `NEXT_TURN` with duration decrement and expiry cleanup; extended with CON save + `halfOnSave` behavior.
- 2026-02-20: Added manual status removal actions (character/monster) before expiration via combat modal and unified combat action API.
- 2026-02-20: Improved poison auto-tick trigger detection (localized labels + automation kind), and surfaced auto-tick summary in `Next turn` success notifications.
- 2026-02-20: Added status template foundation (DB model + migration + session status-template endpoint + dice-based automation support in combat engine).
- 2026-02-20: Extended GM Toolkit (`Монстры`) with status template management CRUD.
- 2026-02-20: Reworked statuses UX in toolkit: collapsed `Статусы` block (`Просмотр`, `+`, search), modal create/edit form, numeric rounds input, effect-category options, save-condition constructor (`%`, `XdY`, operator, target), configurable status color, and compact colored summary cards with edit/delete icons.
- 2026-02-20: Added deferred roadmap item to filter combat-phase journal to interaction-only entries and hide technical system events (`turn passed`, `round advanced`, etc.) from that view.
- 2026-02-20: Added explicit `TD1 — Tech debt return` block with agreed priorities: status short-label field, combat log filtering, effect-rule immutability snapshot, SessionView decomposition, automation tests, and CSS cleanup.
- 2026-02-20: Completed first TD1 batch: status template `shortLabel` (meta persistence + editor field), combat journal interaction-only filtering, and immutable template snapshot persisted into applied effect payload.
- 2026-02-20: Started SessionView decomposition by extracting combat journal into dedicated miniapp component (`CombatJournal`), and completed CSS cleanup for stale status-dot/combat-card legacy selectors.
- 2026-02-20: Added integration smoke script `test-combat-automation.ps1` covering combat-action apply via template, immutable template snapshot, auto-tick decrement/expiry, and combat event payload checks.
- 2026-02-20: Continued SessionView decomposition by extracting encounter queue rendering (`CombatTurnGrid`) and GM actor interaction modal (`CombatActorModal`) into dedicated miniapp components.
- 2026-02-20: Expanded `test-combat-automation.ps1` coverage with idempotent apply replay checks, remove-effect + undo-restore path, and combat event assertions for `effect_removed` and `combat_action_undone`.
- 2026-02-20: Completed SessionView combat-section decomposition by extracting pre-encounter actors board into dedicated component (`PrecombatActorsGrid`), reducing inline page complexity and isolating combat UI blocks.
- 2026-02-20: Hardened `test-combat-automation.ps1` for auth-gated smoke runs: protected-path preflight now treats 401 without Telegram `initData` as explicit skip/pass, enabling stable `run-smoke.ps1 -RunCombatAutomation` in production probe mode.
