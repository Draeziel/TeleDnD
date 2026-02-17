export type AbilityKey = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';

export interface ContentEntity {
  id: string;
  name: string;
  contentSourceId?: string;
  contentSource?: {
    id: string;
    name: string;
  };
}

export interface CharacterSummary {
  id: string;
  name: string;
  level: number;
  classId: string;
  raceId: string | null;
  backgroundId: string | null;
  abilityScoreSetId: string | null;
  class: {
    id: string;
    name: string;
  };
  race: {
    id: string;
    name: string;
  } | null;
  background: {
    id: string;
    name: string;
  } | null;
}

export interface SheetAbilityScores {
  id: string;
  method: string;
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
}

export interface CharacterSheet {
  character: {
    id: string;
    name: string;
    level: number;
    class: { id: string; name: string; contentSource: string };
    race: { id: string; name: string; contentSource: string } | null;
    background: { id: string; name: string; contentSource: string } | null;
    abilityScores: SheetAbilityScores | null;
  };
  features: Array<{
    id: string;
    name: string;
    description?: string;
    source: string;
  }>;
  requiredChoices: DraftChoice[];
  selectedChoices: Array<{
    choiceId: string;
    selectedOption: string;
    choiceName: string;
  }>;
  missingChoices: DraftChoice[];
  inventory: Array<{
    id: string;
    equipped: boolean;
    item: { id: string; name: string; description?: string; slot?: string };
  }>;
  equippedItems: Array<{
    id: string;
    equipped: boolean;
    item: { id: string; name: string; description?: string; slot?: string };
  }>;
  abilityScores: {
    base: SheetAbilityScores | null;
    effective: SheetAbilityScores | null;
  };
  derivedStats: {
    abilityModifiers: Record<AbilityKey, number>;
    armorClass: number;
    attackBonus: number;
    proficiencyBonus: number;
    initiative: number;
    passive: {
      perception: number;
      investigation: number;
      insight: number;
    };
  };
  skills: Array<{
    id: string;
    name: string;
    ability: AbilityKey | string;
    proficient: boolean;
    bonus: number;
  }>;
  savingThrows: Array<{
    ability: AbilityKey;
    proficient: boolean;
    bonus: number;
  }>;
}

export interface DraftChoiceOption {
  id: string;
  name: string;
  description?: string;
}

export interface DraftChoice {
  id: string;
  sourceType: string;
  chooseCount: number;
  options: DraftChoiceOption[];
}

export interface DraftState {
  id: string;
  name: string;
  level: number;
  class: { id: string; name: string; contentSource: string } | null;
  race: { id: string; name: string; contentSource: string } | null;
  background: { id: string; name: string; contentSource: string } | null;
  abilityScores: SheetAbilityScores | null;
  createdAt: string;
  requiredChoices: DraftChoice[];
  selectedChoices: Array<{
    choiceId: string;
    selectedOption?: string;
  }>;
  missingChoices: DraftChoice[];
}

export interface FinalizeDraftResponse {
  message: string;
  characterId: string;
  character: CharacterSummary;
}

export interface SessionListItem {
  id: string;
  name: string;
  joinCode: string;
  gmUserId: string;
  createdByUserId: string;
  role: 'GM' | 'PLAYER';
  hasActiveGm: boolean;
  createdAt: string;
  updatedAt: string;
  playersCount: number;
  charactersCount: number;
}

export interface SessionPlayer {
  id: string;
  role: 'GM' | 'PLAYER';
  user: {
    id: string;
    telegramId: string;
  };
}

export interface SessionCharacterState {
  id: string;
  sessionCharacterId: string;
  currentHp: number;
  maxHpSnapshot: number;
  tempHp: number | null;
  initiative: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SessionEffect {
  id: string;
  sessionCharacterId: string;
  effectType: string;
  duration: string;
  payload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface SessionEvent {
  id: string;
  type: string;
  message: string;
  actorTelegramId: string;
  createdAt: string;
}

export interface SessionDetails {
  id: string;
  name: string;
  joinCode: string;
  gmUserId: string;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  hasActiveGm: boolean;
  events: SessionEvent[];
  players: SessionPlayer[];
  characters: Array<{
    id: string;
    character: {
      id: string;
      name: string;
      level: number;
      class: {
        id: string;
        name: string;
      };
    };
    state: SessionCharacterState | null;
    effects: SessionEffect[];
  }>;
}

export interface SessionSummary {
  id: string;
  name: string;
  joinCode: string;
  createdAt: string;
  updatedAt: string;
  playersCount: number;
  hasActiveGm: boolean;
  events: SessionEvent[];
  characters: Array<{
    id: string;
    character: {
      id: string;
      name: string;
      level: number;
      class: {
        id: string;
        name: string;
      };
    };
    state: SessionCharacterState | null;
    effectsCount: number;
  }>;
}
