# Ability Scores Implementation

## Overview

This document describes the Ability Score Assignment system added to the RPG Character Service. The system supports multiple methods for assigning ability scores (standard array, point buy, manual, roll) with comprehensive validation.

## Database Changes

### New Model: `AbilityScoreSet`

**Location**: `prisma/schema.prisma`

```prisma
model AbilityScoreSet {
  id        String      @id @default(uuid())
  method    String      // "standard_array", "point_buy", "manual", "roll"
  str       Int
  dex       Int
  con       Int
  int       Int
  wis       Int
  cha       Int
  characters Character[]
  drafts    CharacterDraft[]

  @@map("ability_score_sets")
}
```

**Key Design Decisions**:
- Reusable entity: Can be shared across multiple characters/drafts
- Flexible method field: Supports extensible ability score assignment methods
- No hardcoded bonuses: Ready for future modifier system integration

### Updated Models

**Character Model**:
- Added optional `abilityScoreSetId` field
- Foreign key to `AbilityScoreSet` with `onDelete: SetNull`
- Allows characters to be created without ability scores

**CharacterDraft Model**:
- Added optional `abilityScoreSetId` field
- Foreign key to `AbilityScoreSet` with `onDelete: SetNull`
- Enables ability score assignment during draft workflow

### Migration

**Migration Name**: `20260216182403_mig4`

**Changes**:
1. Added `abilityScoreSetId` column to `characters` table
2. Added `abilityScoreSetId` column to `character_drafts` table
3. Created `ability_score_sets` table with schema above
4. Added foreign key constraints with SET NULL on delete

## Service Layer

### DraftService

**File**: `src/services/draftService.ts`

#### New Method: `setAbilityScoresForDraft()`

```typescript
async setAbilityScoresForDraft(
  draftId: string,
  method: string,
  scores: { str: number; dex: number; con: number; int: number; wis: number; cha: number }
): Promise<any>
```

**Features**:
- Validates ability scores based on method
- Creates or updates `AbilityScoreSet` entity
- Links ability score set to draft
- Returns updated draft with ability scores included

**Validation Logic**:
- **standard_array**: Must match [15, 14, 13, 12, 10, 8] in any order
- **point_buy**: Scores 8-15, total cost ≤ 27 points
  - Cost: (score - 8) for 8-13, +7 for 14, +9 for 15
- **manual**: Scores 3-20 (accepts any valid range)
- **roll**: Scores 3-20 (accepts any valid range)

#### Private Method: `validateAbilityScores()`

```typescript
private validateAbilityScores(
  method: string,
  scores: { str: number; dex: number; con: number; int: number; wis: number; cha: number }
): void
```

**Purpose**: Validates ability scores according to method-specific rules

#### Updated Method: `getDraft()`

- Added `abilityScores` to Prisma query includes
- Returns `abilityScores` field in response (null if not set)

#### Updated Method: `finalizeDraft()`

- Copies `abilityScoreSetId` from draft to created character
- Preserves ability scores through character creation process

### CharacterSheetService

**File**: `src/services/characterSheetService.ts`

#### Updated Method: `buildCharacterSheet()`

**Changes**:
- Added `abilityScores` to character Prisma query includes
- Includes full ability score data in character sheet response
- Prepares structure for future modifier calculations

**Response Structure**:
```json
{
  "character": {
    "id": "...",
    "abilityScores": {
      "id": "...",
      "method": "standard_array",
      "str": 15,
      "dex": 14,
      "con": 13,
      "int": 12,
      "wis": 10,
      "cha": 8
    }
  },
  "features": [...],
  "requiredChoices": [...],
  "selectedChoices": [...],
  "missingChoices": [...]
}
```

## Controller Layer

### DraftController

**File**: `src/controllers/draftController.ts`

#### New Method: `setAbilityScores()`

```typescript
public async setAbilityScores(req: Request, res: Response): Promise<void>
```

**Endpoint**: `POST /api/drafts/:id/ability-scores`

**Request Body**:
```json
{
  "method": "standard_array|point_buy|manual|roll",
  "str": number,
  "dex": number,
  "con": number,
  "int": number,
  "wis": number,
  "cha": number
}
```

**Validation**:
- Checks all required fields present
- Returns 400 for missing parameters
- Returns 400 for validation errors
- Returns 404 for draft not found

**Response**: Updated draft with ability scores

## Routes

### DraftRoutes

**File**: `src/routes/draftRoutes.ts`

#### Added Route

```typescript
router.post('/:id/ability-scores', draftController.setAbilityScores.bind(draftController));
```

**Route Order** (after background, before choices):
```
POST /api/drafts/:id/class
POST /api/drafts/:id/race
POST /api/drafts/:id/background
POST /api/drafts/:id/ability-scores    ← NEW
POST /api/drafts/:id/choices
POST /api/drafts/:id/finalize
```

## Type Definitions

### Updated Types

**File**: `src/types/index.ts`

#### New Interface: `AbilityScoreSet`

```typescript
export interface AbilityScoreSet {
  id: string;
  method: string;
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
}
```

#### Updated: `Character` Interface

- Added `raceId?: string`
- Added `backgroundId?: string`
- Added `abilityScoreSetId?: string`

#### Updated: `CharacterDraft` Interface

- Added `raceId?: string`
- Added `backgroundId?: string`
- Added `abilityScoreSetId?: string`

#### Updated: `CharacterSheetResponse` Interface

- Added `race` to character object (optional)
- Added `background` to character object (optional)
- Added `abilityScores` to character object (optional)

#### Updated: `DraftResponse` Interface

- Added `race` to response (optional)
- Added `background` to response (optional)
- Added `abilityScores` to response (optional)

## API Examples

### Example 1: Standard Array

```bash
POST /api/drafts/draft-uuid/ability-scores
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

**Response**:
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

### Example 2: Point Buy

```bash
POST /api/drafts/draft-uuid/ability-scores
Content-Type: application/json

{
  "method": "point_buy",
  "str": 14,
  "dex": 12,
  "con": 13,
  "int": 10,
  "wis": 12,
  "cha": 11
}
```

Total cost: 6 + 4 + 5 + 2 + 4 + 3 = 24 (within 27 limit) ✓

### Example 3: Manual Assignment

```bash
POST /api/drafts/draft-uuid/ability-scores
Content-Type: application/json

{
  "method": "manual",
  "str": 16,
  "dex": 14,
  "con": 15,
  "int": 12,
  "wis": 13,
  "cha": 11
}
```

### Example 4: Rolled Scores

```bash
POST /api/drafts/draft-uuid/ability-scores
Content-Type: application/json

{
  "method": "roll",
  "str": 16,
  "dex": 14,
  "con": 15,
  "int": 12,
  "wis": 13,
  "cha": 11
}
```

### Example 5: Invalid Standard Array (Error)

```bash
POST /api/drafts/draft-uuid/ability-scores
Content-Type: application/json

{
  "method": "standard_array",
  "str": 16,
  "dex": 14,
  "con": 13,
  "int": 12,
  "wis": 10,
  "cha": 8
}
```

**Response** (400):
```json
{
  "message": "Invalid standard array scores. Must use values: 15, 14, 13, 12, 10, 8"
}
```

## Complete Draft Workflow

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

# 4. Set ability scores (NEW)
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

# 5. Select all required choices
curl -X POST http://localhost:4000/api/drafts/$DRAFT_ID/choices \
  -H "Content-Type: application/json" \
  -d '{"choiceId": "CHOICE_ID_1", "selectedOption": "option"}'

# 6. Finalize to create character
curl -X POST http://localhost:4000/api/drafts/$DRAFT_ID/finalize
```

## Testing

### REST Client File

**Location**: `test.rest`

**New Endpoints Added**:
- `POST /api/drafts/:id/ability-scores` with standard array example
- `POST /api/drafts/:id/ability-scores` with point buy example
- `POST /api/drafts/:id/ability-scores` with manual assignment example
- `POST /api/drafts/:id/ability-scores` with rolled scores example
- `POST /api/drafts/:id/ability-scores` with invalid standard array (error test)

### Compilation Status

- ✅ TypeScript compilation: No errors
- ✅ Type checking: All types valid
- ✅ Build output: Generated successfully
- ✅ Migration applied: mig4 created successfully

## Future Enhancements

### Planned Features

1. **Modifier System**
   - Automatic ability score bonuses from racial traits
   - Item modifiers
   - Temporary status modifiers
   - Example: Human racial +1/+1 distribution

2. **Derived Statistics**
   - Ability score modifiers
   - Attack bonuses
   - Save DC calculations
   - AC calculations based on ability scores

3. **Validation Enhancements**
   - Custom validation rules per game system
   - Asymmetric point buy systems
   - Multi-phase ability assignment

4. **History Tracking**
   - Record ability score adjustments
   - Audit trail for modifications
   - Rollback capability

## Architecture Notes

### Design Principles

1. **Reusability**: `AbilityScoreSet` is independent entity
   - Can be created once and shared
   - Potential for templates/presets
   - Efficient storage

2. **Extensibility**: Method field is flexible string
   - Easy to add new assignment methods
   - Custom game system support
   - Validation per method

3. **Data Integrity**: Proper foreign key constraints
   - SET NULL on delete (ability scores are optional)
   - Referential integrity maintained
   - Cascade delete from character/draft

4. **No Hardcoded Logic**: All validation rules in code
   - Prepared for database-driven rules (future)
   - Method-specific validation clearly separated
   - Error messages are descriptive

### Extensibility Considerations

- **Ready for modifiers**: Ability scores are base values, not modified
- **Ready for templates**: Could add `AbilityScoreTemplate` model
- **Ready for history**: Could add `AbilityScoreHistory` model for changes
- **Ready for validation rules**: Could move validation to database

## Performance Notes

- `AbilityScoreSet` is small (< 50 bytes per row)
- Minimal overhead for include in queries
- Foreign key lookups are efficient
- No N+1 query issues with single include

## Security Notes

- All validation happens server-side
- No ability score values in validation logic leaks information
- Method field is not user-editable after assignment
- Clear error messages don't expose system details

## Compliance

- ✅ Supports D&D 5e standard array
- ✅ Supports D&D 5e point buy
- ✅ Supports homebrew manual assignment
- ✅ Supports recorded rolled scores
- ⏳ Ready for other game systems
