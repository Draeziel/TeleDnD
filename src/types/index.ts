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

export interface Character {
    id: string;
    name: string;
    classId: string;
    level: number;
    raceId?: string;
    backgroundId?: string;
    abilityScoreSetId?: string;
}

export interface Class {
    id: string;
    name: string;
    contentSourceId: string;
}

export interface Feature {
    id: string;
    name: string;
    description?: string;
    contentSourceId: string;
}

export interface ClassFeature {
    id: string;
    classId: string;
    featureId: string;
    levelRequired: number;
}

export interface Choice {
    id: string;
    contentSourceId: string;
    sourceType: string;
    sourceId: string;
    chooseCount: number;
    optionsJson: any;
}

export interface CharacterChoice {
    id: string;
    characterId: string;
    choiceId: string;
    selectedOption: string;
}

export interface CharacterDraft {
    id: string;
    name: string;
    level: number;
    classId?: string;
    raceId?: string;
    backgroundId?: string;
    abilityScoreSetId?: string;
    createdAt: Date;
}

export interface CharacterDraftChoice {
    id: string;
    draftId: string;
    choiceId: string;
    selectedOption?: string;
}

export interface CharacterSheetResponse {
    character: {
        id: string;
        name: string;
        level: number;
        class: {
            id: string;
            name: string;
            contentSource: string;
        };
        race?: {
            id: string;
            name: string;
            contentSource: string;
        } | null;
        background?: {
            id: string;
            name: string;
            contentSource: string;
        } | null;
        abilityScores?: AbilityScoreSet | null;
    };
    features: Array<{
        id: string;
        name: string;
        description?: string;
        levelGranted: number;
    }>;
    requiredChoices: Array<{
        id: string;
        sourceType: string;
        chooseCount: number;
        options: any;
    }>;
    selectedChoices: Array<{
        choiceId: string;
        selectedOption: string;
        choiceName: string;
    }>;
    missingChoices: Array<{
        id: string;
        sourceType: string;
        chooseCount: number;
        options: any;
    }>;
}

export interface DraftResponse {
    id: string;
    name: string;
    level: number;
    class: {
        id: string;
        name: string;
        contentSource: string;
    } | null;
    race?: {
        id: string;
        name: string;
        contentSource: string;
    } | null;
    background?: {
        id: string;
        name: string;
        contentSource: string;
    } | null;
    abilityScores?: AbilityScoreSet | null;
    createdAt: Date;
    requiredChoices: Array<{
        id: string;
        sourceType: string;
        chooseCount: number;
        options: any;
    }>;
    selectedChoices: Array<{
        choiceId: string;
        selectedOption?: string;
    }>;
    missingChoices: Array<{
        id: string;
        sourceType: string;
        chooseCount: number;
        options: any;
    }>;
}

export * from './capabilities';