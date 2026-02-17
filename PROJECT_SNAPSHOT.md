# RPG Character Service - Project Snapshot

**Last Updated**: 2026-02-17 20:30 UTC  
**Status**: Beta - Sessions + ownership enforcement deployed  
**Tech Stack**: Node.js + TypeScript, Express, PostgreSQL, Prisma ORM, React + Vite + TypeScript, Cloudflare Pages, Render

---

## 1. Project Goal

Build a comprehensive backend service for managing characters in tabletop RPG systems (D&D-like). The system provides a data-driven character creation workflow where:

- All game rules are stored in a database (not hardcoded)
- Characters go through a multi-step draft process (class → race → background → choices → ability scores → finalize)
- Character attributes are computed dynamically from database definitions
- The system is extensible for future game mechanics (modifiers, equipment, progression)

**Target**: Stable production baseline for Telegram Mini App character creation flow

---

## 2. Current Architecture

### Layered Design

```
┌─────────────────────────────────────────┐
│ HTTP Layer (Express Routes)             │
├─────────────────────────────────────────┤
│ Controllers (Request/Response Handling) │
├─────────────────────────────────────────┤
│ Services (Business Logic)               │
├─────────────────────────────────────────┤
│ Prisma ORM (Database Access)            │
├─────────────────────────────────────────┤
│ PostgreSQL (Persistent Storage)         │
└─────────────────────────────────────────┘
```

### Core Layers

#### **Rules Layer** (Database-driven)
All game content stored in database:
- **ContentSource**: Grouping for related content (e.g., "SRD Demo", "Homebrew")
- **Class/Race/Background**: Base options for characters
- **Feature**: Abilities granted to characters
- **Choice**: Decision points during creation (skill selection, equipment, etc.)

#### **Draft Workflow Layer**
Step-by-step character creation:
- Create empty draft
- Set class → triggers required choice loading
- Set race (optional) → adds race features/choices
- Set background (optional) → adds background features/choices
- Set ability scores → validates against method (standard_array, point_buy, manual, roll)
- Save choices → one by one as user decides
- Finalize → validate all choices complete, create Character record, delete draft

#### **Character Sheet Layer**
Dynamic computation service:
- Gathers character data (class, race, background)
- Queries all applicable features (from class by level, from race, from background)
- Calculates required vs. completed choices
- Returns complete sheet for display

---

## 3. Database Overview

### Core Models

| Model | Purpose | Key Fields |
|-------|---------|-----------|
| **ContentSource** | Groups related content | `id`, `name`, relations to all content |
| **Class** | Character class definition | `id`, `name`, `contentSourceId` |
| **Race** | Character race definition | `id`, `name`, `contentSourceId` |
| **Background** | Character background definition | `id`, `name`, `contentSourceId` |
| **Feature** | Ability or trait | `id`, `name`, `description`, `contentSourceId` |
| **ClassFeature** | Links class to features by level | `classId`, `featureId`, `levelRequired` |
| **RaceFeature** | Links race to features | `raceId`, `featureId` |
| **BackgroundFeature** | Links background to features | `backgroundId`, `featureId` |
| **Choice** | Decision point with options | `sourceType` (class/race/background), `sourceId`, `chooseCount`, `optionsJson` |
| **Character** | Permanent character record | `id`, `name`, `level`, `classId`, `raceId`, `backgroundId`, `abilityScoreSetId` |
| **ClassSavingThrowProficiency** | Class-level saving throw proficiencies | `id`, `classId`, `ability` |
| **Skill** | Skill metadata with governing ability | `id`, `name`, `ability`, `contentSourceId` |
| **CharacterSkillProficiency** | Links characters to proficient skills | `id`, `characterId`, `skillId` |
| **CharacterChoice** | Character's selected choice | `characterId`, `choiceId`, `selectedOption` |
| **CharacterDraft** | Character being created | `id`, `name`, `level`, `classId`, `raceId`, `backgroundId`, `abilityScoreSetId` |
| **CharacterDraftChoice** | Draft's selected choice | `draftId`, `choiceId`, `selectedOption` |
| **AbilityScoreSet** | Ability scores storage | `method`, `str`, `dex`, `con`, `int`, `wis`, `cha` |

### Relationship Diagram

```
ContentSource
├── Class ──> ClassFeature ──> Feature
│         └── ClassSavingThrowProficiency
├── Race ──> RaceFeature ──> Feature
├── Background ──> BackgroundFeature ──> Feature
└── Choice (from class/race/background)

Character
├── class (Class)
├── race (Race)
├── background (Background)
├── abilityScores (AbilityScoreSet)
├── characterChoices (CharacterChoice[])
└── skillProficiencies (CharacterSkillProficiency[])

CharacterDraft
├── class (Class)
├── race (Race)
├── background (Background)
├── abilityScores (AbilityScoreSet)
└── characterDraftChoices (CharacterDraftChoice[])
```

---

## 4. Implemented Features

### ✅ Character Creation Draft System
- Create empty draft: `POST /api/drafts`
- Set class: `POST /api/drafts/:id/class`
- Set race: `POST /api/drafts/:id/race`
- Set background: `POST /api/drafts/:id/background`
- Set ability scores: `POST /api/drafts/:id/ability-scores`
- Save choices: `POST /api/drafts/:id/choices`
- Get draft status: `GET /api/drafts/:id`
- Finalize draft: `POST /api/drafts/:id/finalize`

### ✅ Character Sheet Computation
- Dynamic feature calculation (class features by level, race/background features)
- Choice requirement computation from all sources (class + race + background)
- Track selected vs. missing choices
- Include ability scores in sheet response
- Derived statistics (ability modifiers, armor class, attack bonus, proficiency bonus)
- Initiative and passive checks (Perception/Investigation/Insight)
- Skill bonuses computed from ability scores and proficiency data
- Saving throw bonuses computed from ability modifiers and class proficiencies

### ✅ Telegram Mini App Frontend
- React + Vite + TypeScript miniapp in `miniapp/`
- Wizard pages for character creation, character list, and character sheet views
- Session pages: list/create/join and session view with party state
- API layer with `/api` relative base URL and Vite dev proxy
- Telegram WebApp integration (init + user context + initData forwarding)

### ✅ Security & Runtime Hardening
- Telegram `initData` signature verification middleware on `/api/drafts/*`
- Telegram auth context for session and private character operations
- Configurable strict mode via `REQUIRE_TELEGRAM_AUTH`
- Configurable `auth_date` max age (`TELEGRAM_INITDATA_MAX_AGE_SEC`)
- API rate limiting on `/api/*` (`API_RATE_LIMIT_WINDOW_MS`, `API_RATE_LIMIT_MAX`)
- Health endpoint `GET /healthz` for deploy/uptime probes

### ✅ Session / Party System (Phase 1 core)
- Session lifecycle: create/list/join/leave/get by `joinCode`
- Session party model: attach/remove character with session-scoped state
- GM gameplay actions: set HP, set initiative, apply effects
- Session view polling in miniapp (7s interval)

### ✅ Ownership & Access Control
- `Character.ownerUserId` used for per-user visibility and access checks
- Character list filtered to current Telegram user
- Character read/sheet/delete restricted to owner
- Draft finalize now sets `ownerUserId` to prevent post-create access regressions
- Character delete available in miniapp list (`Delete` action)

### ✅ Deployment
- Frontend deployed on Cloudflare Pages
- Backend + PostgreSQL deployed on Render
- Render Blueprint/config documented in `render.yaml` and `DEPLOYMENT_RENDER.md`

### ✅ Derived Statistics Layer
- Computes base vs. effective ability score blocks and per-ability modifiers
- Calculates proficiency bonus from level progression thresholds
- Produces aggregate armor class and attack bonus values from applied modifiers
- Generates saving throw bonuses per ability using effective modifiers and class-level proficiency records

### ✅ Skill System
- Prisma `Skill` and `CharacterSkillProficiency` models capture metadata and proficiencies
- Character sheet lists every skill with governing ability, proficiency flag, and total bonus
- Seed script populates demo SRD skills to validate derived calculations

### ✅ Ability Score Assignment
- Four methods: standard_array, point_buy, manual, roll
- Method-specific validation:
  - **standard_array**: Must match [15, 14, 13, 12, 10, 8]
  - **point_buy**: 8-15 scores, ≤27 points total cost
  - **manual**/**roll**: 3-20 range
- Reusable entity (can be shared across characters/drafts)
- Included in character sheet response

### ✅ Multi-Source Features
- Class features with level requirements
- Race features (all levels)
- Background features (all levels)
- Features combined in character sheet with source attribution

### ✅ Choice System
- Class choices, race choices, background choices
- Multiple choice selection (choose N from M options)
- Flexible JSON storage for option data
- Validated during draft finalization

### ✅ Data-Driven Architecture
- All game rules in database (not hardcoded)
- Extensible choice system (supports any type of selection)
- Flexible feature system (can store any metadata)
- Ready for modifier system, equipment, items, etc.

---

## 5. Key API Endpoints

### Draft Workflow

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/drafts` | Create new character draft |
| `GET` | `/api/drafts/:id` | Get draft status with required/missing choices |
| `POST` | `/api/drafts/:id/class` | Set class (loads required choices) |
| `POST` | `/api/drafts/:id/race` | Set race (optional) |
| `POST` | `/api/drafts/:id/background` | Set background (optional) |
| `POST` | `/api/drafts/:id/ability-scores` | Set ability scores |
| `POST` | `/api/drafts/:id/choices` | Save a choice selection |
| `POST` | `/api/drafts/:id/finalize` | Validate and create Character |

### Character Operations

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/characters` | Create character directly (legacy) |
| `GET` | `/api/characters` | List current user's characters |
| `GET` | `/api/characters/:id` | Get character basic info |
| `DELETE` | `/api/characters/:id` | Delete owned character |
| `GET` | `/api/characters/:id/sheet` | Get complete character sheet with features, derived stats, and skills |

### Session Operations

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/sessions` | Create session (creator becomes GM) |
| `GET` | `/api/sessions` | List sessions for current user |
| `POST` | `/api/sessions/join` | Join session by code |
| `POST` | `/api/sessions/:id/leave` | Leave session |
| `GET` | `/api/sessions/:id` | Get session details (players/characters/state/effects) |
| `POST` | `/api/sessions/:id/characters` | Attach owned character to session |
| `DELETE` | `/api/sessions/:id/characters/:characterId` | Detach character from session |
| `POST` | `/api/sessions/:sessionId/characters/:characterId/set-hp` | GM: set HP |
| `POST` | `/api/sessions/:sessionId/characters/:characterId/set-initiative` | GM: set initiative |
| `POST` | `/api/sessions/:sessionId/characters/:characterId/apply-effect` | GM: apply effect |

### Query Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/characters/classes` | Get available classes (for reference) |
| `GET` | `/api/characters/races` | Get available races (for wizard) |
| `GET` | `/api/characters/backgrounds` | Get available backgrounds (for wizard) |
| `GET` | `/healthz` | Health probe endpoint |

---

## 6. Current Development Stage

**Status**: ✅ Backend + Mini App integrated and deployed

The project is functionally complete for MVP usage with:
- Database schema supporting all core concepts
- Draft workflow fully implemented and tested
- Ability score assignment system with validation
- Character sheet computation service
- Telegram Mini App frontend connected to public backend
- Sessions/party flow available in miniapp
- Telegram request authentication on draft/session/private character operations
- Ownership enforcement for character visibility and CRUD access
- Basic operational hardening (health-check + rate-limit)
- Type-safe TypeScript codebase
- Zero compilation errors

**What's working**:
- Multi-step character creation
- Race/Class/Background selection
- Feature computation from all sources
- Choice selection and validation
- Ability score assignment (4 methods)
- Derived statistics and skill bonuses on character sheet
- Saving throw bonuses derived from class proficiencies
- Initiative and passive checks derived from computed skills/stats
- Public deployment on Cloudflare + Render
- Error handling and validation
- Session create/join and live party view with polling
- Owned-character deletion from miniapp list

**What's not yet implemented**:
- Role/user management auth beyond Telegram initData checks
- Advanced anti-abuse controls (global quotas, per-user throttling, WAF rules)
- Character progression/leveling
- Deep observability (metrics dashboard, alerting)

---

## 7. Next Planned Steps

### Immediate Next Sprint
- Add attach/detach character UX in Session View (owner action)
- Add session endpoint smoke checks to `run-smoke.ps1` and `run-tests.ps1`
- Update README with session + ownership endpoint/auth docs
- Add initiative order list (sorted by initiative) for faster combat flow

### Near-term Improvements
- Structured request logging and correlation IDs
- Render/Cloudflare uptime monitor and alerting
- Character roster enhancements (sorting/searching)

### Mid-term Gameplay Depth
- Character progression/leveling flow
- Expand inventory/equipment constraints and loadout rules
- Extend modifier pipeline for more source types/effects

---

## Development Quick Start

### Setup
```bash
npm install
npx prisma migrate dev        # Apply migrations
npm run seed                  # Populate demo content
npm run build                 # Compile TypeScript
node dist/server.js          # Start server (port 4000)
```

### Testing
- Use `test.rest` file with REST Client extension
- All endpoints documented with examples
- POST `/api/drafts` to create draft and test workflow
- Quick smoke command: `./run-smoke.ps1`
- Run post-deploy smoke suite: `./run-tests.ps1 -Smoke -BaseUrl https://telednd-backend.onrender.com`

### Adding New Content
```typescript
// Example: Add new race via seed.ts
const elf = await prisma.race.create({
  data: {
    name: 'Elf',
    contentSourceId: srdSource.id
  }
});

// Add race features
await prisma.raceFeature.create({
  data: {
    raceId: elf.id,
    featureId: darkvisionFeature.id
  }
});

// Add race choices if needed
await prisma.choice.create({
  data: {
    contentSourceId: srdSource.id,
    sourceType: 'race',
    sourceId: elf.id,
    chooseCount: 1,
    optionsJson: [...]
  }
});
```

---

## File Structure Overview

```
rpg-character-service/
├── prisma/
│   ├── schema.prisma         (Database schema)
│   └── migrations/           (Database migrations: mig1-4, add_modifier_model, add_inventory_models, add_skills_models, add_class_saving_throw_proficiencies)
├── src/
│   ├── app.ts               (Express app setup)
│   ├── server.ts            (Server startup)
│   ├── controllers/
│   │   ├── draftController.ts
│   │   └── characterController.ts
│   ├── services/
│   │   ├── draftService.ts           (Draft workflow logic)
│   │   ├── characterService.ts       (Legacy CRUD helpers)
│   │   ├── characterSheetService.ts  (Sheet computation & derived stats)
│   │   ├── inventoryService.ts       (Inventory and equipment helpers)
│   │   ├── modifierService.ts        (Applies modifiers to stats)
│   │   └── skillService.ts           (Skill metadata & proficiency access)
│   ├── routes/
│   │   ├── draftRoutes.ts
│   │   └── characterRoutes.ts
│   ├── types/
│   │   └── index.ts         (TypeScript interfaces)
│   ├── middleware/
│   │   ├── errorHandler.ts
│   │   └── telegramAuth.ts
│   └── utils/
│       └── logger.ts
├── miniapp/                 (Telegram Mini App frontend: React + Vite + TS)
│   ├── src/
│   │   ├── pages/           (Characters, Sheet, Wizard)
│   │   ├── api/             (HTTP client + endpoints)
│   │   ├── components/      (Layout + shared UI)
│   │   └── telegram/        (WebApp bootstrap helpers)
│   └── vite.config.ts
├── scripts/
│   └── seed.ts              (Database population)
├── dist/                    (Compiled JavaScript output)
├── package.json
├── tsconfig.json
├── .env                     (Database connection)
├── test.rest               (API test file)
└── README.md               (User documentation)
```

---

## Key Design Decisions

1. **Data-Driven**: All game rules in database, no hardcoded logic
2. **Reusable Entities**: Features, choices, ability scores can be shared across content
3. **Flexible JSON Storage**: Choices use JSON for flexible option data
4. **Nullable Foreign Keys**: Characters don't require race/background initially
5. **Draft Pattern**: Separates creation process from character records
6. **Service Layer**: Decouples routes from business logic
7. **TypeScript**: Full type safety for maintainability
8. **Prisma**: Type-safe database access with migrations

---

## Dependencies

- **Runtime**: Node.js 22.13+, Express 4.17+, @prisma/client 5.22+
- **Database**: PostgreSQL 13+
- **Development**: TypeScript 5+, ts-node
- **Docker**: Optional containerization (Dockerfile + docker-compose.yml provided)

---

## Testing Endpoints

### Create Character via Draft (Full Workflow)
```bash
# 1. Create draft
curl -X POST http://localhost:4000/api/drafts \
  -H "Content-Type: application/json" \
  -d '{"name": "Aldric"}'

# 2. Set class (returns DRAFT_ID in response)
curl -X POST http://localhost:4000/api/drafts/DRAFT_ID/class \
  -H "Content-Type: application/json" \
  -d '{"classId": "CLASS_ID"}'

# 3. Set ability scores
curl -X POST http://localhost:4000/api/drafts/DRAFT_ID/ability-scores \
  -H "Content-Type: application/json" \
  -d '{
    "method": "standard_array",
    "str": 15, "dex": 14, "con": 13,
    "int": 12, "wis": 10, "cha": 8
  }'

# 4. Make choices, then finalize
curl -X POST http://localhost:4000/api/drafts/DRAFT_ID/finalize

# 5. View character sheet (use CHARACTER_ID from finalize response)
curl http://localhost:4000/api/characters/CHARACTER_ID/sheet
```

---

## Known Limitations

1. Telegram auth currently enforced only on draft endpoints (`/api/drafts/*`)
2. Single-database deployment (no horizontal scaling yet)
3. No caching layer (Redis/CDN strategy not introduced)
4. Character deletion and advanced account-scoped ownership are not implemented
5. No centralized metrics/alerting stack yet

---

## Contributing Notes

When adding new features:
1. Update Prisma schema if new data structures needed
2. Create migration: `npx prisma migrate dev --name feature_name`
3. Update services with business logic
4. Add controller endpoints
5. Register routes in Express app
6. Update TypeScript interfaces
7. Add tests in `test.rest`
8. Update documentation

---

## Support & References

- **Prisma Documentation**: https://www.prisma.io/docs/
- **Express Documentation**: https://expressjs.com/
- **PostgreSQL**: https://www.postgresql.org/docs/
- **D&D 5e SRD**: Available in seed.ts as demo content
- **Project Docs**: See README.md for full API documentation

---

**Last verified**: 2026-02-17  
**Migration status**: ✅ includes `add_class_saving_throw_proficiencies` and prior content migrations  
**Build status**: ✅ backend and miniapp compile successfully  
**Deployment status**: ✅ frontend (Cloudflare Pages) + backend/db (Render) live
