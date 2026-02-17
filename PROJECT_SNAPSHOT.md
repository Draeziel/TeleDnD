# RPG Character Service - Project Snapshot

**Last Updated**: 2026-02-16 22:00 UTC  
**Status**: Alpha - Core character builder engine complete  
**Tech Stack**: Node.js + TypeScript, Express, PostgreSQL, Prisma ORM, Docker

---

## 1. Project Goal

Build a comprehensive backend service for managing characters in tabletop RPG systems (D&D-like). The system provides a data-driven character creation workflow where:

- All game rules are stored in a database (not hardcoded)
- Characters go through a multi-step draft process (class → race → background → choices → ability scores → finalize)
- Character attributes are computed dynamically from database definitions
- The system is extensible for future game mechanics (modifiers, equipment, progression)

**Target**: Telegram Mini App UI integration for step-by-step character creation wizard

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
- Skill bonuses computed from ability scores and proficiency data
- Saving throw bonuses computed from ability modifiers and class proficiencies

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
| `GET` | `/api/characters/:id` | Get character basic info |
| `GET` | `/api/characters/:id/sheet` | Get complete character sheet with features, derived stats, and skills |

### Query Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/characters/classes` | Get available classes (for reference) |

---

## 6. Current Development Stage

**Status**: ✅ Core backend engine complete

The character builder backend is functionally complete with:
- Database schema supporting all core concepts
- Draft workflow fully implemented and tested
- Ability score assignment system with validation
- Character sheet computation service
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
- Error handling and validation

**What's not yet implemented**:
- Equipment system
- Modifier system (racial bonuses auto-applied)
- Character progression/leveling
- Telegram Mini App UI
- API authentication/authorization
- Character roster/management

---

## 7. Next Planned Steps

### Phase 1: Equipment System (Ready to implement)
```
Equipment Packages
├── Equipment Set (e.g., "Martial Weapons")
├── Equipment (sword, armor, etc.)
└── Character Equipment selection
```

### Phase 2: Modifier System (Architecture planned)
```
Ability Score Modifiers
├── Racial bonuses (e.g., Human +1/+1)
├── Item bonuses (e.g., Ring +2 to DEX)
├── Temporary effects (buffs/debuffs)
└── Derived calculations (attack bonus from STR, etc.)
```

### Phase 3: Telegram Mini App UI (Design phase)
```
Step-by-step wizard UI
├── Welcome screen
├── Class selection
├── Race selection
├── Background selection
├── Ability scores wizard
├── Choices wizard
├── Review/confirm
└── Character created!
```

### Phase 4: Extended Features
- Character progression/leveling
- Character roster (save/load)
- Spellcasting system
- Inventory management
- Party formation

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
│   │   └── errorHandler.ts
│   └── utils/
│       └── logger.ts
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

1. No authentication/authorization (add as needed)
2. Ability scores are base values only (modifier system pending)
3. No item system yet (planned)
4. Single-database deployment (no horizontal scaling)
5. No caching layer (add Redis if needed)
6. Character deletion not yet implemented

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

**Last verified**: 2026-02-16  
**Migration status**: ✅ mig4 applied (Ability scores)  
**Build status**: ✅ 0 TypeScript errors  
**Server ready**: ✅ Compiled and ready for deployment
