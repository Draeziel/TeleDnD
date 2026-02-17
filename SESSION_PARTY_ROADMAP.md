# Session / Party System Roadmap

**Last Updated**: 2026-02-17  
**Status**: Phase 1 mostly implemented; docs/ops alignment in progress

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
   - either prohibit leaving as last GM,
   - or transfer GM role before leaving.
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
- [x] Add future lightweight polling endpoint note: `GET /api/sessions/:id/summary`

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
- [ ] Add attach-character action from Character Sheet and/or Session View
- [~] Add API client methods for new session endpoints

### G) Docs & ops

- [~] Update `README.md` with session model and endpoint docs
- [x] Update `PROJECT_SNAPSHOT.md` with phase progress
- [ ] Add smoke checks for session endpoints
- [x] Verify `npm run build` (backend + miniapp)

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

---

## Next Sprint (proposed)

1. Add attach/detach character UX in session view (owner action + GM visibility).
2. Add session smoke checks to `run-smoke.ps1` / `run-tests.ps1`.
3. Update README session docs (auth expectations + endpoint matrix + ownership rules).
4. Add compact initiative order view (sorted list) for faster combat flow.

---

## Open Questions

- Should GM transfer be automatic or explicit when GM leaves?
- Should players be allowed to detach characters attached by GM?
- Do we need soft-delete/audit trail for session events in Phase 1 or later?
- Should `/api/sessions/:id/summary` ship in late Phase 1 or move to Phase 2 optimization?
