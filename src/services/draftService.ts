import { PrismaClient } from '@prisma/client';
import { CharacterSheetService } from './characterSheetService';

export class DraftService {
  private prisma: PrismaClient;
  private characterSheetService: CharacterSheetService;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.characterSheetService = new CharacterSheetService(prisma);
  }

  private async resolveUserByTelegramId(telegramUserId: string) {
    return this.prisma.user.upsert({
      where: { telegramId: telegramUserId },
      update: {},
      create: { telegramId: telegramUserId },
    });
  }

  /**
   * Create a new empty character draft
   */
  async createDraft(name: string): Promise<any> {
    return await this.prisma.characterDraft.create({
      data: {
        name,
      },
    });
  }

  /**
   * Get draft with all required choices and current selections
   */
  async getDraft(draftId: string): Promise<any> {
    const draft = await this.prisma.characterDraft.findUnique({
      where: { id: draftId },
      include: {
        class: {
          include: {
            contentSource: true,
          },
        },
        race: {
          include: {
            contentSource: true,
          },
        },
        background: {
          include: {
            contentSource: true,
          },
        },
        abilityScores: true,
        characterDraftChoices: {
          include: {
            choice: true,
          },
        },
      },
    });

    if (!draft) {
      throw new Error(`Draft with ID ${draftId} not found`);
    }

    let requiredChoices: any[] = [];
    let missingChoices: any[] = [];

    // Build choice filters for class, race, and background
    const choiceFilters: any[] = [];
    if (draft.classId) {
      choiceFilters.push({ sourceType: 'class', sourceId: draft.classId });
    }
    if (draft.raceId) {
      choiceFilters.push({ sourceType: 'race', sourceId: draft.raceId });
    }
    if (draft.backgroundId) {
      choiceFilters.push({ sourceType: 'background', sourceId: draft.backgroundId });
    }

    // If any source is selected, calculate required choices
    if (choiceFilters.length > 0) {
      requiredChoices = await this.prisma.choice.findMany({
        where: {
          OR: choiceFilters,
        },
      });

      // Calculate missing choices
      const selectedChoiceIds = new Set(
        draft.characterDraftChoices.map(dc => dc.choiceId)
      );
      missingChoices = requiredChoices.filter(
        choice => !selectedChoiceIds.has(choice.id)
      );
    }

    return {
      id: draft.id,
      name: draft.name,
      level: draft.level,
      class: draft.class
        ? {
            id: draft.class.id,
            name: draft.class.name,
            contentSource: draft.class.contentSource.name,
          }
        : null,
      race: draft.race
        ? {
            id: draft.race.id,
            name: draft.race.name,
            contentSource: draft.race.contentSource.name,
          }
        : null,
      background: draft.background
        ? {
            id: draft.background.id,
            name: draft.background.name,
            contentSource: draft.background.contentSource.name,
          }
        : null,
      abilityScores: draft.abilityScores
        ? {
            id: draft.abilityScores.id,
            method: draft.abilityScores.method,
            str: draft.abilityScores.str,
            dex: draft.abilityScores.dex,
            con: draft.abilityScores.con,
            int: draft.abilityScores.int,
            wis: draft.abilityScores.wis,
            cha: draft.abilityScores.cha,
          }
        : null,
      createdAt: draft.createdAt,
      requiredChoices: requiredChoices.map(choice => ({
        id: choice.id,
        sourceType: choice.sourceType,
        chooseCount: choice.chooseCount,
        options: choice.optionsJson,
      })),
      selectedChoices: draft.characterDraftChoices.map(dc => ({
        choiceId: dc.choiceId,
        selectedOption: dc.selectedOption,
      })),
      missingChoices: missingChoices.map(choice => ({
        id: choice.id,
        sourceType: choice.sourceType,
        chooseCount: choice.chooseCount,
        options: choice.optionsJson,
      })),
    };
  }

  /**
   * Set the class for a draft
   */
  async setClassForDraft(draftId: string, classId: string): Promise<any> {
    const draft = await this.prisma.characterDraft.update({
      where: { id: draftId },
      data: {
        classId,
      },
      include: {
        class: {
          include: {
            contentSource: true,
          },
        },
      },
    });

    return this.getDraft(draftId);
  }

  /**
   * Set the race for a draft
   */
  async setRaceForDraft(draftId: string, raceId: string): Promise<any> {
    const draft = await this.prisma.characterDraft.update({
      where: { id: draftId },
      data: {
        raceId,
      },
      include: {
        race: {
          include: {
            contentSource: true,
          },
        },
      },
    });

    return this.getDraft(draftId);
  }

  /**
   * Set the background for a draft
   */
  async setBackgroundForDraft(draftId: string, backgroundId: string): Promise<any> {
    const draft = await this.prisma.characterDraft.update({
      where: { id: draftId },
      data: {
        backgroundId,
      },
      include: {
        background: {
          include: {
            contentSource: true,
          },
        },
      },
    });

    return this.getDraft(draftId);
  }

  /**
   * Validate ability scores based on method
   */
  private validateAbilityScores(
    method: string,
    scores: { str: number; dex: number; con: number; int: number; wis: number; cha: number }
  ): void {
    const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];

    if (method === 'standard_array') {
      const providedScores = Object.values(scores).sort((a, b) => b - a);
      const matches = JSON.stringify(providedScores) === JSON.stringify(STANDARD_ARRAY);
      if (!matches) {
        throw new Error(
          `Invalid standard array scores. Must use values: ${STANDARD_ARRAY.join(', ')}`
        );
      }
    } else if (method === 'point_buy') {
      // Simple point buy validation: total cost check
      // Standard D&D 5e point buy: 27 points available, each score 8-15 costs differently
      const scores_array = Object.values(scores);
      const minValid = scores_array.every(s => s >= 8 && s <= 15);
      if (!minValid) {
        throw new Error('Point buy scores must be between 8 and 15');
      }
      // Simple cost validation (actual formula: (score - 8) for 8-13, +1 for 14, +2 for 15)
      let totalCost = 0;
      for (const score of scores_array) {
        if (score < 8 || score > 15) {
          throw new Error('Point buy scores must be between 8 and 15');
        }
        if (score <= 13) {
          totalCost += score - 8;
        } else if (score === 14) {
          totalCost += 6 + 1;
        } else if (score === 15) {
          totalCost += 6 + 2;
        }
      }
      if (totalCost > 27) {
        throw new Error(`Point buy total cost ${totalCost} exceeds limit of 27`);
      }
    } else if (method === 'manual') {
      // Accept any values for manual assignment
      const scores_array = Object.values(scores);
      if (scores_array.some(s => s < 3 || s > 20)) {
        throw new Error('Manual ability scores must be between 3 and 20');
      }
    } else if (method === 'roll') {
      // Rolled scores should typically be in valid range
      const scores_array = Object.values(scores);
      if (scores_array.some(s => s < 3 || s > 20)) {
        throw new Error('Rolled ability scores must be between 3 and 20');
      }
    } else {
      throw new Error(`Unknown ability score method: ${method}`);
    }
  }

  /**
   * Set ability scores for a draft
   */
  async setAbilityScoresForDraft(
    draftId: string,
    method: string,
    scores: { str: number; dex: number; con: number; int: number; wis: number; cha: number }
  ): Promise<any> {
    // Validate the draft exists
    const draft = await this.prisma.characterDraft.findUnique({
      where: { id: draftId },
    });

    if (!draft) {
      throw new Error(`Draft with ID ${draftId} not found`);
    }

    // Validate ability scores based on method
    this.validateAbilityScores(method, scores);

    // Create or update ability score set
    let abilityScoreSet;

    if (draft.abilityScoreSetId) {
      // Update existing
      abilityScoreSet = await this.prisma.abilityScoreSet.update({
        where: { id: draft.abilityScoreSetId },
        data: {
          method,
          ...scores,
        },
      });
    } else {
      // Create new
      abilityScoreSet = await this.prisma.abilityScoreSet.create({
        data: {
          method,
          ...scores,
        },
      });

      // Link to draft
      await this.prisma.characterDraft.update({
        where: { id: draftId },
        data: {
          abilityScoreSetId: abilityScoreSet.id,
        },
      });
    }

    return this.getDraft(draftId);
  }

  /**
   * Add or update a selected choice for the draft
   */
  async saveChoiceForDraft(
    draftId: string,
    choiceId: string,
    selectedOption: string
  ): Promise<any> {
    // Upsert: create if doesn't exist, update if it does
    await this.prisma.characterDraftChoice.upsert({
      where: {
        draftId_choiceId: {
          draftId,
          choiceId,
        },
      },
      update: {
        selectedOption,
      },
      create: {
        draftId,
        choiceId,
        selectedOption,
      },
    });

    return this.getDraft(draftId);
  }

  /**
   * Finalize the draft - validate and create character
   */
  async finalizeDraft(draftId: string, telegramUserId: string): Promise<any> {
    const user = await this.resolveUserByTelegramId(telegramUserId);

    const draft = await this.prisma.characterDraft.findUnique({
      where: { id: draftId },
      include: {
        characterDraftChoices: {
          include: {
            choice: true,
          },
        },
      },
    });

    if (!draft) {
      throw new Error(`Draft with ID ${draftId} not found`);
    }

    if (!draft.classId) {
      throw new Error('Cannot finalize draft: class not selected');
    }

    // Get all required choices for class, race, and background
    const choiceFilters: any[] = [
      { sourceType: 'class', sourceId: draft.classId },
    ];
    if (draft.raceId) {
      choiceFilters.push({ sourceType: 'race', sourceId: draft.raceId });
    }
    if (draft.backgroundId) {
      choiceFilters.push({
        sourceType: 'background',
        sourceId: draft.backgroundId,
      });
    }

    const requiredChoices = await this.prisma.choice.findMany({
      where: {
        OR: choiceFilters,
      },
    });

    // Check if all required choices are completed
    const selectedChoiceIds = new Set(
      draft.characterDraftChoices.map(dc => dc.choiceId)
    );
    const missingChoiceIds = requiredChoices
      .filter(choice => !selectedChoiceIds.has(choice.id))
      .map(choice => choice.id);

    if (missingChoiceIds.length > 0) {
      throw new Error(
        `Cannot finalize draft: missing ${missingChoiceIds.length} required choices`
      );
    }

    // Validate that all selected choices have selectedOption values
    const incompleteChoices = draft.characterDraftChoices.filter(
      dc => !dc.selectedOption
    );

    if (incompleteChoices.length > 0) {
      throw new Error(
        `Cannot finalize draft: ${incompleteChoices.length} choices do not have selected options`
      );
    }

    // Create the character with class, race, and background
    const character = await this.prisma.character.create({
      data: {
        name: draft.name,
        level: draft.level,
        ownerUserId: user.id,
        classId: draft.classId,
        raceId: draft.raceId || undefined,
        backgroundId: draft.backgroundId || undefined,
        abilityScoreSetId: draft.abilityScoreSetId || undefined,
      },
    });

    // Create character choices from draft choices
    await this.prisma.characterChoice.createMany({
      data: draft.characterDraftChoices.map(dc => ({
        characterId: character.id,
        choiceId: dc.choiceId,
        selectedOption: dc.selectedOption!,
      })),
    });

    // Delete the draft
    await this.prisma.characterDraft.delete({
      where: { id: draftId },
    });

    return {
      message: 'Character created successfully',
      characterId: character.id,
      character: {
        id: character.id,
        name: character.name,
        level: character.level,
        classId: character.classId,
        raceId: character.raceId,
        backgroundId: character.backgroundId,
      },
    };
  }
}
