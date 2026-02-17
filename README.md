# RPG Character Service

## Overview
This project is a backend service for managing characters in a tabletop RPG, similar to Dungeons & Dragons. It is built using Node.js, TypeScript, Express, PostgreSQL, and Prisma ORM, and is containerized using Docker.

## Technologies Used
- Node.js
- TypeScript
- Express
- PostgreSQL
- Prisma ORM
- Docker

## Project Structure
```
rpg-character-service
├── src
│   ├── app.ts
│   ├── server.ts
│   ├── controllers
│   │   └── characterController.ts
│   ├── services
│   │   └── characterService.ts
│   ├── routes
│   │   └── characterRoutes.ts
│   ├── middleware
│   │   └── errorHandler.ts
│   ├── types
│   │   └── index.ts
│   └── utils
│       └── logger.ts
├── prisma
│   ├── schema.prisma
│   └── migrations
├── scripts
│   └── seed.ts
├── docker-compose.yml
├── Dockerfile
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

## Setup Instructions

### Prerequisites
- Node.js (version 14 or higher)
- Docker and Docker Compose
- PostgreSQL

### Installation
1. Clone the repository:
   ```
   git clone <repository-url>
   cd rpg-character-service
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Set up the environment variables:
   - Copy the `.env.example` to `.env` and update the database connection settings.

4. Set up the database:
   - Run the following command to create the database and apply migrations:
   ```
   npx prisma migrate dev --name init
   ```

5. Seed the database with initial data:
   ```
   npx ts-node scripts/seed.ts
   ```

### Running the Application
You can run the application using Docker Compose:
```
docker-compose up
```

### Telegram WebApp initData Validation

The backend validates Telegram Mini App user context for protected endpoints.

Configure environment variables:

```env
TELEGRAM_BOT_TOKEN=<your_bot_token>
REQUIRE_TELEGRAM_AUTH=true
ALLOW_TELEGRAM_USER_ID_FALLBACK=false
TELEGRAM_INITDATA_MAX_AGE_SEC=86400
API_RATE_LIMIT_WINDOW_MS=60000
API_RATE_LIMIT_MAX=120
REQUEST_SLOW_MS=1200
SESSION_EVENTS_CLEANUP_ENABLED=true
SESSION_EVENTS_RETENTION_DAYS=30
SESSION_EVENTS_CLEANUP_INTERVAL_MIN=60
```

- `TELEGRAM_BOT_TOKEN` – Telegram bot token used for signature verification.
- `REQUIRE_TELEGRAM_AUTH` – when `true`, protected endpoints reject requests without valid `x-telegram-init-data`. If omitted, defaults to `true` in production.
- `ALLOW_TELEGRAM_USER_ID_FALLBACK` – allows `x-telegram-user-id` fallback only in non-production mode (for dev/test).
- `TELEGRAM_INITDATA_MAX_AGE_SEC` – maximum allowed age of `auth_date` in seconds.
- `API_RATE_LIMIT_WINDOW_MS` – rate-limit window for all `/api/*` routes in milliseconds (default: `60000`).
- `API_RATE_LIMIT_MAX` – max requests per IP in one window for `/api/*` routes (default: `120`).
- `REQUEST_SLOW_MS` – threshold in milliseconds for slow-request warning logs (default: `1200`).
- `SESSION_EVENTS_CLEANUP_ENABLED` – enables scheduled cleanup of old session events (defaults to `true`, except `test`).
- `SESSION_EVENTS_RETENTION_DAYS` – keep session events for this many days before deletion (default: `30`).
- `SESSION_EVENTS_CLEANUP_INTERVAL_MIN` – cleanup task interval in minutes (default: `60`).

Protected groups:
- `/api/drafts/*`
- `/api/sessions/*`
- `/api/characters/*` except public reference endpoints:
  - `GET /api/characters/classes`
  - `GET /api/characters/races`
  - `GET /api/characters/backgrounds`

In local/dev mode, set `REQUIRE_TELEGRAM_AUTH=false` and `ALLOW_TELEGRAM_USER_ID_FALLBACK=true` to emulate Telegram user context via `x-telegram-user-id`.

### Health Check

- `GET /healthz` returns service liveness payload (`status`, `env`, `uptimeSec`, timestamp, `requestId`).
- `GET /readyz` verifies runtime readiness, including database connectivity (`200` when ready, `503` otherwise).

### API Endpoints

#### Public reference endpoints
- `GET /api/characters/classes`: Retrieve all classes.
- `GET /api/characters/races`: Retrieve all races.
- `GET /api/characters/backgrounds`: Retrieve all backgrounds.

#### Protected character endpoints (Telegram user required)
- `GET /api/characters`: List current user's characters.
- `POST /api/characters`: Create character owned by current user.
- `GET /api/characters/:id`: Retrieve owned character by ID.
- `DELETE /api/characters/:id`: Delete owned character.
- `GET /api/characters/:id/sheet`: Retrieve owned complete character sheet.
- `POST /api/characters/:id/choices`: Save choices for owned character.
- `POST /api/characters/:id/items`: Add item to owned character inventory.
- `POST /api/characters/:id/items/:itemId/equip`: Equip item on owned character.
- `POST /api/characters/:id/items/:itemId/unequip`: Unequip item on owned character.

#### Protected draft endpoints (Telegram user required)
- `POST /api/drafts`
- `GET /api/drafts/:id`
- `POST /api/drafts/:id/class`
- `POST /api/drafts/:id/race`
- `POST /api/drafts/:id/background`
- `POST /api/drafts/:id/ability-scores`
- `POST /api/drafts/:id/choices`
- `POST /api/drafts/:id/finalize`

#### Protected session endpoints (Telegram user required)
- `POST /api/sessions`: Create session (creator becomes GM).
- `GET /api/sessions`: List sessions for current user.
- `POST /api/sessions/join`: Join by `joinCode`.
- `POST /api/sessions/:id/leave`: Leave session (session may continue without active GM).
- `DELETE /api/sessions/:id`: Delete session (GM only).
- `GET /api/sessions/:id`: Full session details (members/party/state/effects).
- `GET /api/sessions/:id/summary`: Lightweight polling payload.
- `GET /api/sessions/:id/events`: Lightweight event feed (supports `?limit=`).
- `POST /api/sessions/:id/characters`: Attach owned character to session.
- `DELETE /api/sessions/:id/characters/:characterId`: Remove character from session (owner or GM).
- `POST /api/sessions/:sessionId/characters/:characterId/set-hp`: GM only.
- `POST /api/sessions/:sessionId/characters/:characterId/set-initiative`: GM only.
- `POST /api/sessions/:id/initiative/roll-all`: GM rolls initiative for all attached characters.
- `POST /api/sessions/:id/initiative/roll-self`: Player rolls initiative for owned attached character.
- `POST /api/sessions/:id/initiative/lock`: GM locks initiative changes/re-rolls.
- `POST /api/sessions/:id/initiative/unlock`: GM unlocks initiative changes/re-rolls.
- `POST /api/sessions/:id/initiative/reset`: GM resets all initiative values and unlocks.
- `POST /api/sessions/:id/encounter/start`: GM starts encounter and sets first active turn by initiative.
- `POST /api/sessions/:id/encounter/next-turn`: GM advances active turn and increments round on wrap.
- `POST /api/sessions/:id/encounter/end`: GM ends encounter and clears active turn.
- `POST /api/sessions/:sessionId/characters/:characterId/apply-effect`: GM only.

### Smoke Testing

Run post-deploy smoke checks:

```powershell
powershell -ExecutionPolicy Bypass -File ./run-smoke.ps1 -BaseUrl https://telednd-backend.onrender.com
```

Optional local dev user for non-strict environments:

```powershell
powershell -ExecutionPolicy Bypass -File ./run-smoke.ps1 -BaseUrl http://localhost:4000 -TestTelegramUserId 123456789
```

Strict Telegram auth smoke (real initData):

```powershell
powershell -ExecutionPolicy Bypass -File ./run-smoke.ps1 -BaseUrl https://telednd-backend.onrender.com -TelegramInitData "<telegram-init-data>"
```

In strict Telegram auth environments, protected endpoints may return `401` without real `initData`; smoke output marks these checks as auth-gated instead of hard failures.

#### Character Sheet Endpoint (`GET /api/characters/:id/sheet`)
Returns a complete character sheet with computed features, required choices, and selected choices. This is the primary endpoint for displaying a character's full information.

**Response Example:**
```json
{
  "character": {
    "id": "uuid",
    "name": "Character Name",
    "level": 1,
    "class": {
      "id": "uuid",
      "name": "Barbarian",
      "contentSource": "SRD Demo"
    }
  },
  "features": [
    {
      "id": "uuid",
      "name": "Rage",
      "description": "You can enter a furious rage as an action on your turn.",
      "levelGranted": 1
    },
    {
      "id": "uuid",
      "name": "Unarmored Defense",
      "description": "While you are not wearing any armor, your AC equals 10 + your Dexterity modifier.",
      "levelGranted": 1
    }
  ],
  "requiredChoices": [
    {
      "id": "uuid",
      "sourceType": "class",
      "chooseCount": 2,
      "options": [
        { "id": "acrobatics", "name": "Acrobatics", "description": "Dexterity" },
        { "id": "animal_handling", "name": "Animal Handling", "description": "Wisdom" }
      ]
    }
  ],
  "selectedChoices": [
    {
      "choiceId": "uuid",
      "selectedOption": "acrobatics",
      "choiceName": "class"
    }
  ],
  "missingChoices": [
    {
      "id": "uuid",
      "sourceType": "class",
      "chooseCount": 1,
      "options": [...]
    }
  ],
  "modifiers": [
    {
      "id": "uuid",
      "sourceType": "feature",
      "sourceId": "uuid",
      "target": "attack",
      "operation": "add",
      "value": 2
    }
  ],
  "abilityScores": {
    "base": {
      "id": "uuid",
      "method": "standard_array",
      "str": 15,
      "dex": 14,
      "con": 13,
      "int": 12,
      "wis": 10,
      "cha": 8
    },
    "effective": {
      "id": "uuid",
      "method": "standard_array",
      "str": 16,
      "dex": 15,
      "con": 14,
      "int": 13,
      "wis": 11,
      "cha": 9
    }
  },
  "inventory": [
    {
      "id": "uuid",
      "equipped": true,
      "item": {
        "id": "uuid",
        "name": "Longsword",
        "description": "+1 attack bonus melee weapon",
        "slot": "weapon"
      }
    }
  ],
  "equippedItems": [
    {
      "id": "uuid",
      "equipped": true,
      "item": {
        "id": "uuid",
        "name": "Longsword",
        "description": "+1 attack bonus melee weapon",
        "slot": "weapon"
      }
    }
  ],
  "derivedStats": {
    "abilityModifiers": {
      "str": 3,
      "dex": 2,
      "con": 2,
      "int": 1,
      "wis": 0,
      "cha": -1
    },
    "armorClass": 16,
    "attackBonus": 2,
    "proficiencyBonus": 2,
    "initiative": 2,
    "passive": {
      "perception": 10,
      "investigation": 11,
      "insight": 10
    }
  },
  "savingThrows": [
    {
      "ability": "str",
      "proficient": true,
      "bonus": 5
    },
    {
      "ability": "con",
      "proficient": true,
      "bonus": 4
    }
  ],
  "skills": [
    {
      "name": "Athletics",
      "ability": "str",
      "proficient": true,
      "bonus": 5
    },
    {
      "name": "Perception",
      "ability": "wis",
      "proficient": false,
      "bonus": 0
    },
    {
      "name": "Investigation",
      "ability": "int",
      "proficient": false,
      "bonus": 1
    },
    {
      "name": "Insight",
      "ability": "wis",
      "proficient": false,
      "bonus": 0
    }
  ]
}
```

See [services/characterSheetService.ts](src/services/characterSheetService.ts) for implementation details. Features are computed dynamically using SQL queries based on `ClassFeature.levelRequired <= Character.level`.

### Modifier Engine Skeleton

The character sheet now returns a `modifiers` array describing raw modifier definitions applied to the character. These are aggregated by the new `ModifierService` using the `modifiers` table, allowing races, backgrounds, features, items, or effects to contribute data-driven adjustments. The array is exposed alongside the ability score block so downstream consumers can recompute any rule-driven outputs deterministically.

Ability score adjustments are calculated dynamically during sheet assembly. The response includes `abilityScores.base` (the persisted values) and `abilityScores.effective` (after applying all `target="ability"` modifiers via `ModifierService.applyAbilityModifiers`). Stored values remain unchanged; stacking occurs purely in memory so additional sources like items or temporary effects can participate without schema changes.

### Derived Statistics

`CharacterSheetService` now materializes a `derivedStats` payload using the effective ability scores and raw modifiers without persisting anything:

- `abilityModifiers` – standard D20 modifiers computed as `floor((score - 10) / 2)` for each ability.
- `armorClass` – base 10, plus Dexterity modifier, plus additive AC modifiers; set-based AC modifiers override the computed total when higher.
- `attackBonus` – sum of additive attack modifiers currently affecting the character.
- `proficiencyBonus` – computed from character level (1-4 → +2, 5-8 → +3, 9-12 → +4, 13-16 → +5, 17-20 → +6).
- `initiative` – Dexterity modifier plus any additive initiative modifiers gathered from the modifier list.
- `passive` – object containing `perception`, `investigation`, and `insight`, each equal to `10 +` the already-computed skill bonus for that skill.

### Saving Throw Computation

The character sheet also includes a `savingThrows` array with six entries (one per ability). Each entry reports:

- `ability` – ability key (`str`, `dex`, `con`, `int`, `wis`, `cha`).
- `proficient` – true when the character's class grants proficiency via `class_saving_throw_proficiencies`.
- `bonus` – the sum of the effective ability modifier and proficiency bonus when proficient.

All saving throw bonuses are computed on the fly from the effective ability scores and class-level proficiency records—nothing is persisted in the database.

### Skill Computation

The sheet now includes a `skills` array sourced entirely from the database. Each entry is computed at request time using:

- `abilityModifier` derived from `derivedStats.abilityModifiers[skill.ability]`.
- `proficiencyBonus` added only when the character has a matching record in `character_skill_proficiencies`.
- `bonus = abilityModifier + (proficient ? proficiencyBonus : 0)`.

Skills are defined in the `skills` table (seeded with a demo SRD subset) so new skills or homebrew proficiencies can be introduced without code changes.

The same computed bonuses feed the passive perception/investigation/insight values, so no additional persistence or rule duplication is required.

### Inventory System Skeleton

Characters can now own and equip items. Inventory state is entirely data-driven using the new `items` and `character_items` tables. Equipping an item simply flips the `equipped` flag on the join table, and any modifiers with `sourceType = "item"` are merged into the modifier list when an item is marked as equipped. Current endpoints:

- `POST /api/characters/:id/items` – attach an existing item record to the character.
- `POST /api/characters/:id/items/:itemId/equip` – toggle `equipped = true`.
- `POST /api/characters/:id/items/:itemId/unequip` – toggle `equipped = false`.

The seed data includes a Longsword (+1 attack) and Chain Mail (sets base AC to 16) so the workflow can be exercised end-to-end. Future work can expand on slot validation, loadouts, and derived stat recalculation by consuming the shared modifier array already exposed in the character sheet.

## Character Draft Workflow

The Character Draft system provides a step-by-step wizard for creating characters. Characters must complete all required choices before being finalized into permanent Character records.

### Draft API Endpoints

#### 1. Create Draft
```
POST /api/drafts
Content-Type: application/json

{
  "name": "My New Character"
}
```

Returns a new empty draft:
```json
{
  "id": "draft-uuid",
  "name": "My New Character",
  "level": 1,
  "class": null,
  "createdAt": "2026-02-16T...",
  "requiredChoices": [],
  "selectedChoices": [],
  "missingChoices": []
}
```

#### 2. Set Class
```
POST /api/drafts/:id/class
Content-Type: application/json

{
  "classId": "barbarian-uuid"
}
```

Returns updated draft with `requiredChoices` and `missingChoices` populated based on class.

#### 3. Save Choice
```
POST /api/drafts/:id/choices
Content-Type: application/json

{
  "choiceId": "choice-uuid",
  "selectedOption": "acrobatics"
}
```

Updates or creates a choice selection in the draft.

#### 4. Finalize Draft
```
POST /api/drafts/:id/finalize
```

Validates:
- Class is selected
- All required choices are completed with selected options

If valid:
- Creates a new Character record
- Creates CharacterChoice records from draft choices
- Deletes the draft

Returns:
```json
{
  "message": "Character created successfully",
  "characterId": "character-uuid",
  "character": {
    "id": "character-uuid",
    "name": "My New Character",
    "level": 1,
    "classId": "barbarian-uuid"
  }
}
```

#### 5. Get Draft Status
```
GET /api/drafts/:id
```

Returns full draft state including:
- Draft metadata
- Required choices (all choices for the selected class)
- Selected choices (choices with non-null selectedOption)
- Missing choices (required choices without selections)

### Draft Workflow Example

```bash
# 1. Create draft
DRAFT_ID=$(curl -s -X POST http://localhost:4000/api/drafts \
  -H "Content-Type: application/json" \
  -d '{"name": "Grok"}' | jq -r '.id')

# 2. Set class (Barbarian)
curl -X POST http://localhost:4000/api/drafts/$DRAFT_ID/class \
  -H "Content-Type: application/json" \
  -d '{"classId": "barbarian-uuid"}'

# 3. Select first skill choice
curl -X POST http://localhost:4000/api/drafts/$DRAFT_ID/choices \
  -H "Content-Type: application/json" \
  -d '{"choiceId": "choice-uuid", "selectedOption": "acrobatics"}'

# 4. Check status
curl http://localhost:4000/api/drafts/$DRAFT_ID

# 5. After all choices completed, finalize
curl -X POST http://localhost:4000/api/drafts/$DRAFT_ID/finalize
```

### Architecture Highlights

- ✅ **Reuses CharacterSheetService logic** for computing required choices
- ✅ **Data-driven choices** - all choices determined by database rules
- ✅ **Validation before finalization** - ensures data integrity
- ✅ **No hardcoded game logic** - all rules from database

## Race and Background Integration

The system now supports Race and Background as well as Class, with each providing features and choices. This extends the character builder to a full multi-attribute character creation workflow.

### Supported Rule Sources

Characters can have features and choices from three sources:

| Source | Features | Choices | Examples |
|--------|----------|---------|----------|
| **Class** | Class-specific abilities | Class-specific selections | Barbarian: Rage; Bard: Bardic Inspiration |
| **Race** | Racial traits | Racial selections | Human: Ability Score Improvement |
| **Background** | Background features | Background equipment, bonds, etc. | Soldier: Military Rank |

### Race and Background APIs

#### Set Race for Draft
```
POST /api/drafts/:id/race
Content-Type: application/json

{
  "raceId": "race-uuid"
}
```

Returns updated draft with race features and updated required choices.

#### Set Background for Draft
```
POST /api/drafts/:id/background
Content-Type: application/json

{
  "backgroundId": "background-uuid"
}
```

Returns updated draft with background features and updated required choices.

#### Get Draft Status with Race and Background
```
GET /api/drafts/:id
```

Now returns:
```json
{
  "class": { "id": "...", "name": "Barbarian", "contentSource": "SRD Demo" },
  "race": { "id": "...", "name": "Human", "contentSource": "SRD Demo" },
  "background": { "id": "...", "name": "Soldier", "contentSource": "SRD Demo" },
  "requiredChoices": [
    // Choices from class + race + background combined
  ]
}
```

### Complete Draft Creation with Race and Background

```bash
# 1. Create draft
DRAFT_ID=$(curl -s -X POST http://localhost:4000/api/drafts \
  -H "Content-Type: application/json" \
  -d '{"name": "Aldric"}' | jq -r '.id')

# 2. Select class
curl -X POST http://localhost:4000/api/drafts/$DRAFT_ID/class \
  -H "Content-Type: application/json" \
  -d '{"classId": "BARBARIAN_ID"}'

# 3. Select race
curl -X POST http://localhost:4000/api/drafts/$DRAFT_ID/race \
  -H "Content-Type: application/json" \
  -d '{"raceId": "HUMAN_ID"}'

# 4. Select background
curl -X POST http://localhost:4000/api/drafts/$DRAFT_ID/background \
  -H "Content-Type: application/json" \
  -d '{"backgroundId": "SOLDIER_ID"}'

# 5. Complete all required choices

# 6. Finalize to create character
curl -X POST http://localhost:4000/api/drafts/$DRAFT_ID/finalize
```

### Character Sheet with Race and Background

The `GET /api/characters/:id/sheet` endpoint now returns features from all three sources (class, race, background) in a single `features` array.

### Seed Data

The default seed includes:

**Races:**
- Human (Ability Score Improvement feature)

**Backgrounds:**
- Soldier (Military Rank feature, Equipment choice)

### Features are Computed Dynamically

- ✅ Features from class based on `ClassFeature.levelRequired`
- ✅ Features from race (no level requirement)
- ✅ Features from background (no level requirement)
- ✅ Choices from all three sources combined in required/missing lists
- ✅ No hardcoded conditions (e.g., "if race == human")

### Testing the Character Sheet Endpoint

After seeding the database, you can test the endpoint with curl:

```bash
# Create a Barbarian character
curl -X POST http://localhost:3000/api/characters \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Grok",
    "classId": "<barbarian-class-id>",
    "level": 1
  }'

# Get the character sheet (replace <character-id> with actual ID)
curl http://localhost:3000/api/characters/<character-id>/sheet
```

The character sheet will automatically include:
- **Granted features**: All features where `levelRequired <= character.level`
- **Required choices**: All choices for the character's class
- **Selected choices**: Any choices the character has already selected
- **Missing choices**: Required choices not yet selected by the character

All computations are performed using database queries, ensuring no hardcoded game logic.

## Ability Score Assignment

The system includes a flexible ability score assignment system supporting multiple methods for character attribute distribution.

### Supported Ability Score Methods

| Method | Rules | Min/Max | Example |
|--------|-------|---------|---------|
| **standard_array** | Must use preset array: [15, 14, 13, 12, 10, 8] | 8-15 | [15, 14, 13, 12, 10, 8] |
| **point_buy** | D&D 5e point buy system, 27 points to distribute | 8-15 | [14, 13, 12, 11, 10, 10] |
| **manual** | Free assignment by player | 3-20 | [16, 14, 13, 12, 11, 10] |
| **roll** | Results from dice rolling | 3-20 | [16, 15, 14, 13, 12, 11] |

### Ability Score Database Model

```typescript
model AbilityScoreSet {
  id     String  @id @default(uuid())
  method String  // "standard_array", "point_buy", "manual", "roll"
  str    Int
  dex    Int
  con    Int
  int    Int
  wis    Int
  cha    Int
  
  characters Character[]
  drafts     CharacterDraft[]
}
```

The `AbilityScoreSet` is a reusable entity that can be shared across multiple characters and drafts, enabling efficient storage and consistency.

### Ability Scores in Character Creation

#### Set Ability Scores for Draft
```
POST /api/drafts/:id/ability-scores
Content-Type: application/json

{
  "method": "standard_array",
  "str": 15,
  "dex": 14,
  "con": 13,
  "int": 12,
  "wis": 10,
  "cha": 8
}
```

Returns updated draft with ability scores included:
```json
{
  "id": "draft-uuid",
  "name": "Aldric",
  "abilityScores": {
    "id": "scores-uuid",
    "method": "standard_array",
    "str": 15,
    "dex": 14,
    "con": 13,
    "int": 12,
    "wis": 10,
    "cha": 8
  }
}
```

#### Standard Array Example
```bash
curl -X POST http://localhost:4000/api/drafts/$DRAFT_ID/ability-scores \
  -H "Content-Type: application/json" \
  -d '{
    "method": "standard_array",
    "str": 15,
    "dex": 14,
    "con": 13,
    "int": 12,
    "wis": 10,
    "cha": 8
  }'
```

#### Point Buy Example
```bash
curl -X POST http://localhost:4000/api/drafts/$DRAFT_ID/ability-scores \
  -H "Content-Type: application/json" \
  -d '{
    "method": "point_buy",
    "str": 14,
    "dex": 12,
    "con": 13,
    "int": 10,
    "wis": 12,
    "cha": 11
  }'
```

#### Manual Assignment Example
```bash
curl -X POST http://localhost:4000/api/drafts/$DRAFT_ID/ability-scores \
  -H "Content-Type: application/json" \
  -d '{
    "method": "manual",
    "str": 16,
    "dex": 14,
    "con": 15,
    "int": 12,
    "wis": 13,
    "cha": 11
  }'
```

#### Rolled Scores Example
```bash
curl -X POST http://localhost:4000/api/drafts/$DRAFT_ID/ability-scores \
  -H "Content-Type: application/json" \
  -d '{
    "method": "roll",
    "str": 16,
    "dex": 14,
    "con": 15,
    "int": 12,
    "wis": 13,
    "cha": 11
  }'
```

### Validation

The system validates ability scores based on the selected method:

- **standard_array**: Must exactly match [15, 14, 13, 12, 10, 8] in any order
- **point_buy**: Scores must be 8-15, total cost must not exceed 27 points
  - Cost calculation: (score - 8) for 8-13, +7 for 14, +9 for 15
- **manual**: Scores must be between 3 and 20
- **roll**: Scores must be between 3 and 20

Invalid scores will return a 400 error with descriptive message:
```json
{
  "message": "Invalid standard array scores. Must use values: 15, 14, 13, 12, 10, 8"
}
```

### Ability Scores in Character Sheet

The character sheet endpoint now includes ability scores:

```
GET /api/characters/:id/sheet
```

Response includes:
```json
{
  "character": {
    "id": "char-uuid",
    "name": "Aldric",
    "level": 1,
    "class": { ... },
    "race": { ... },
    "background": { ... },
    "abilityScores": {
      "id": "scores-uuid",
      "method": "standard_array",
      "str": 15,
      "dex": 14,
      "con": 13,
      "int": 12,
      "wis": 10,
      "cha": 8
    }
  },
  "features": [ ... ],
  "requiredChoices": [ ... ],
  "selectedChoices": [ ... ],
  "missingChoices": [ ... ]
}
```

### Complete Draft Workflow with Ability Scores

```bash
# 1. Create draft
DRAFT_ID=$(curl -s -X POST http://localhost:4000/api/drafts \
  -H "Content-Type: application/json" \
  -d '{"name": "Aldric"}' | jq -r '.id')

# 2. Select class
curl -X POST http://localhost:4000/api/drafts/$DRAFT_ID/class \
  -H "Content-Type: application/json" \
  -d '{"classId": "CLASS_ID"}'

# 3. Select race and background
curl -X POST http://localhost:4000/api/drafts/$DRAFT_ID/race \
  -H "Content-Type: application/json" \
  -d '{"raceId": "RACE_ID"}'

curl -X POST http://localhost:4000/api/drafts/$DRAFT_ID/background \
  -H "Content-Type: application/json" \
  -d '{"backgroundId": "BACKGROUND_ID"}'

# 4. Set ability scores
curl -X POST http://localhost:4000/api/drafts/$DRAFT_ID/ability-scores \
  -H "Content-Type: application/json" \
  -d '{
    "method": "standard_array",
    "str": 15,
    "dex": 14,
    "con": 13,
    "int": 12,
    "wis": 10,
    "cha": 8
  }'

# 5. Complete all required choices

# 6. Finalize to create character
curl -X POST http://localhost:4000/api/drafts/$DRAFT_ID/finalize
```

### Architecture Notes

- ✅ **Reusable entity**: `AbilityScoreSet` can be shared across characters
- ✅ **Method-specific validation**: Each assignment method has appropriate rules
- ✅ **Error handling**: Clear validation errors for invalid score distributions
- ✅ **Extensibility**: Ready for future modifiers from racial bonuses and items
- ⏳ **Future enhancements**: Modifier system for automatic adjustments from class/race/item bonuses

### Usage
Once the application is running, you can use tools like Postman or curl to interact with the API endpoints.

## License
This project is licensed under the MIT License.