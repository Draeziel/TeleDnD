# Session / Party System Roadmap

**Last Updated**: 2026-02-19  
**Status**: Phase 1 implemented and stabilized for production MVP; initiative automation baseline completed

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
- [~] Add error-rate and latency alerting for backend (Render + external monitor integration).
- [~] Define and track basic SLOs (availability, p95 latency, 5xx budget).
- [x] Add CI gate for backend build + miniapp build + smoke checks.

### P1 — Gameplay and UX robustness

- [x] Add encounter flow primitives: start encounter, active turn marker, next turn, finish encounter.
- [ ] Add safe “undo last combat action” for GM (HP/initiative/effect mutations).
- [ ] Add network resilience UX in miniapp (retry/backoff and clearer offline recovery).
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

### P2 — Companion product depth

- [ ] Add session-level resource tracking (consumables/charges/conditions).
- [ ] Introduce gameplay analytics baseline (DAU, session duration, encounter completion, retention).
- [ ] Add optional GM handover workflow while preserving no-transfer leave default.
- [ ] Expand content-source tooling for scalable rule/content packs.
- [ ] Add in-app onboarding checklist for first session run.
- [ ] Add bulk import/sync tooling for global monster bestiary maintenance.

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
