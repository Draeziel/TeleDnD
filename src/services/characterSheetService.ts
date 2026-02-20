import { PrismaClient, AbilityScoreSet, Modifier } from '@prisma/client';
import { ModifierService } from './modifierService';
import { InventoryService } from './inventoryService';
import { SkillService } from './skillService';
import { CapabilityResolverService } from './capabilityResolverService';
import type { CapabilityBaseDto, ResolveCapabilitiesDto } from '../types';

export class CharacterSheetService {
  private prisma: PrismaClient;
  private modifierService: ModifierService;
  private inventoryService: InventoryService;
  private skillService: SkillService;
  private capabilityResolverService: CapabilityResolverService;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.modifierService = new ModifierService(prisma);
    this.inventoryService = new InventoryService(prisma);
    this.skillService = new SkillService(prisma);
    this.capabilityResolverService = new CapabilityResolverService(prisma);
  }

  private static readonly abilityKeys = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;

  private static abilityScoreToModifier(score: number | null | undefined): number {
    if (score === null || score === undefined) {
      return 0;
    }

    return Math.floor((score - 10) / 2);
  }

  private static computeAbilityModifiers(abilityScores: AbilityScoreSet | null) {
    if (!abilityScores) {
      return null;
    }

    return CharacterSheetService.abilityKeys.reduce<Record<string, number>>((mods, key) => {
      mods[key] = CharacterSheetService.abilityScoreToModifier((abilityScores as any)[key]);
      return mods;
    }, {});
  }

  private static computeArmorClass(
    abilityModifiers: Record<string, number> | null,
    modifiers: Modifier[]
  ): number {
    const baseArmorClass = 10;
    const dexModifier = abilityModifiers?.dex ?? 0;

    const additiveBonus = modifiers
      .filter(mod => mod.target === 'ac' && mod.operation === 'add' && mod.value !== null)
      .reduce((total, mod) => total + (mod.value ?? 0), 0);

    const computed = baseArmorClass + dexModifier + additiveBonus;

    const setValues = modifiers
      .filter(mod => mod.target === 'ac' && mod.operation === 'set' && mod.value !== null)
      .map(mod => mod.value as number);

    if (setValues.length === 0) {
      return computed;
    }

    return Math.max(computed, ...setValues);
  }

  private static computeAttackBonus(modifiers: Modifier[]): number {
    return modifiers
      .filter(mod => mod.target === 'attack' && mod.operation === 'add' && mod.value !== null)
      .reduce((total, mod) => total + (mod.value ?? 0), 0);
  }

  private static computeInitiative(
    abilityModifiers: Record<string, number> | null,
    modifiers: Modifier[]
  ): number {
    const dexModifier = abilityModifiers?.dex ?? 0;
    const additiveBonus = modifiers
      .filter(mod => mod.target === 'initiative' && mod.operation === 'add' && mod.value !== null)
      .reduce((total, mod) => total + (mod.value ?? 0), 0);

    return dexModifier + additiveBonus;
  }

  private static computeProficiencyBonus(level: number): number {
    if (level >= 17) {
      return 6;
    }

    if (level >= 13) {
      return 5;
    }

    if (level >= 9) {
      return 4;
    }

    if (level >= 5) {
      return 3;
    }

    return 2;
  }

  private static isResolverSheetAdapterEnabled(): boolean {
    return process.env.SHEET_RESOLVER_ADAPTER_ENABLED === 'true';
  }

  private static mapResolverPassiveFeatures(passiveFeatures: CapabilityBaseDto[]) {
    return passiveFeatures.map((capability) => {
      const payloadName = capability.payload.name;
      const payloadDescription = capability.payload.description;

      return {
        id: capability.id,
        name: typeof payloadName === 'string' ? payloadName : `Feature ${capability.sourceId}`,
        description: typeof payloadDescription === 'string' ? payloadDescription : undefined,
        source: capability.sourceType,
      };
    });
  }

  private static mapResolverModifierCapability(capability: CapabilityBaseDto): Modifier {
    const target = typeof capability.payload.target === 'string' ? capability.payload.target : 'custom';
    const targetKey = capability.payload.targetKey;
    const operation = typeof capability.payload.operation === 'string' ? capability.payload.operation : 'add';
    const value = capability.payload.value;

    return {
      id: capability.id,
      sourceType: capability.sourceType,
      sourceId: capability.sourceId,
      target,
      targetKey: typeof targetKey === 'string' ? targetKey : null,
      operation,
      value: typeof value === 'number' ? value : null,
      rulesVersion: capability.rulesVersion,
      sourceRef: typeof capability.payload.sourceRef === 'string' ? capability.payload.sourceRef : null,
      createdAt: new Date(0),
    };
  }

  private async resolveSheetCapabilities(characterId: string, ownerTelegramId?: string | null): Promise<ResolveCapabilitiesDto | null> {
    if (!CharacterSheetService.isResolverSheetAdapterEnabled()) {
      return null;
    }

    if (!ownerTelegramId) {
      return null;
    }

    return this.capabilityResolverService.resolveCharacterCapabilities(characterId, ownerTelegramId, {
      dirtyNodeIds: ['sheet:build'],
    });
  }

  /**
   * Build a complete character sheet with computed features, choices, and selections.
   * This is a data-driven approach where all game rules are resolved from the database.
   */
  async buildCharacterSheet(characterId: string) {
    // 1. Fetch character base data with race, background, and ability scores
    const character = await this.prisma.character.findUnique({
      where: { id: characterId },
      include: {
        owner: {
          select: {
            telegramId: true,
          },
        },
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
      },
    });

    if (!character) {
      throw new Error(`Character with ID ${characterId} not found`);
    }

    const resolvedCapabilities = await this.resolveSheetCapabilities(characterId, character.owner?.telegramId);

    // 2. Fetch granted class features (features unlocked for this character's level)
    let allGrantedFeatures: Array<{ id: string; name: string; description?: string; source: string }> = [];
    if (resolvedCapabilities) {
      allGrantedFeatures = CharacterSheetService.mapResolverPassiveFeatures(resolvedCapabilities.passiveFeatures);
    } else {
      const classFeatures = await this.prisma.classFeature.findMany({
        where: {
          classId: character.classId,
          levelRequired: {
            lte: character.level,
          },
        },
        include: {
          feature: true,
        },
        orderBy: {
          levelRequired: 'asc',
        },
      });

      let raceFeatures: any[] = [];
      if (character.raceId) {
        raceFeatures = await this.prisma.raceFeature.findMany({
          where: {
            raceId: character.raceId,
          },
          include: {
            feature: true,
          },
        });
      }

      let backgroundFeatures: any[] = [];
      if (character.backgroundId) {
        backgroundFeatures = await this.prisma.backgroundFeature.findMany({
          where: {
            backgroundId: character.backgroundId,
          },
          include: {
            feature: true,
          },
        });
      }

      allGrantedFeatures = [
        ...classFeatures,
        ...raceFeatures,
        ...backgroundFeatures,
      ].map(f => {
        const feature = f.feature || (f as any);
        return {
          id: feature.id,
          name: feature.name,
          description: feature.description,
          source: classFeatures.find(cf => cf.feature.id === feature.id)
            ? 'class'
            : raceFeatures.find(rf => rf.feature.id === feature.id)
            ? 'race'
            : 'background',
        };
      });
    }

    // 5. Fetch required choices for class, race, and background
    const choiceFilters = [
      { sourceType: 'class', sourceId: character.classId },
    ];
    if (character.raceId) {
      choiceFilters.push({ sourceType: 'race', sourceId: character.raceId });
    }
    if (character.backgroundId) {
      choiceFilters.push({
        sourceType: 'background',
        sourceId: character.backgroundId,
      });
    }

    const requiredChoices = await this.prisma.choice.findMany({
      where: {
        OR: choiceFilters,
      },
    });

    // 6. Fetch selected choices for this character
    const selectedChoices = await this.prisma.characterChoice.findMany({
      where: {
        characterId: character.id,
      },
      include: {
        choice: true,
      },
    });

    // 7. Calculate missing required choices
    const selectedChoiceIds = new Set(selectedChoices.map(sc => sc.choiceId));
    const missingChoices = requiredChoices.filter(
      choice => !selectedChoiceIds.has(choice.id)
    );

    // 8. Aggregate raw modifiers available to the character and compute effective ability scores.
    const modifiers = resolvedCapabilities
      ? resolvedCapabilities.modifiers.map(capability => CharacterSheetService.mapResolverModifierCapability(capability))
      : await this.modifierService.getCharacterModifiers(characterId);

    const mapAbilityScores = (scores: AbilityScoreSet | null) =>
      scores
        ? {
            id: scores.id,
            method: scores.method,
            str: scores.str,
            dex: scores.dex,
            con: scores.con,
            int: scores.int,
            wis: scores.wis,
            cha: scores.cha,
          }
        : null;

    const baseAbilitySet = character.abilityScores;
    const baseAbilityScores = mapAbilityScores(baseAbilitySet);
    const effectiveAbilitySet = baseAbilitySet
      ? this.modifierService.applyAbilityModifiers({ ...baseAbilitySet }, modifiers)
      : null;
    const effectiveAbilityScores = mapAbilityScores(effectiveAbilitySet);
    const abilityModifiers = CharacterSheetService.computeAbilityModifiers(effectiveAbilitySet);
    const armorClass = CharacterSheetService.computeArmorClass(abilityModifiers, modifiers);
    const attackBonus = CharacterSheetService.computeAttackBonus(modifiers);
    const proficiencyBonus = CharacterSheetService.computeProficiencyBonus(character.level);
    const [skills, proficiencyEntries, classSavingThrowProficiencies] = await Promise.all([
      this.skillService.getAllSkills(),
      this.skillService.getCharacterSkillProficiencies(characterId),
      this.prisma.classSavingThrowProficiency.findMany({
        where: { classId: character.classId },
      }),
    ]);
    const proficientSkillIds = new Set(proficiencyEntries.map(entry => entry.skillId));
    const computedSkills = skills.map(skill => {
      const abilityKey = skill.ability.toLowerCase();
      const baseModifier = abilityModifiers?.[abilityKey] ?? 0;
      const proficient = proficientSkillIds.has(skill.id);
      const bonus = baseModifier + (proficient ? proficiencyBonus : 0);

      return {
        id: skill.id,
        name: skill.name,
        ability: skill.ability,
        proficient,
        bonus,
      };
    });
    const initiative = CharacterSheetService.computeInitiative(abilityModifiers, modifiers);
    const skillBonusByName = new Map(
      computedSkills.map(skill => [skill.name.toLowerCase(), skill.bonus])
    );
    const getSkillBonus = (name: string) => skillBonusByName.get(name.toLowerCase()) ?? 0;
    const passivePerception = 10 + getSkillBonus('Perception');
    const passiveInvestigation = 10 + getSkillBonus('Investigation');
    const passiveInsight = 10 + getSkillBonus('Insight');
    const classSavingThrowSet = new Set(
      classSavingThrowProficiencies.map(entry => entry.ability.toLowerCase())
    );
    const savingThrows = CharacterSheetService.abilityKeys.map(ability => {
      const baseModifier = abilityModifiers?.[ability] ?? 0;
      const proficient = classSavingThrowSet.has(ability);
      const bonus = baseModifier + (proficient ? proficiencyBonus : 0);

      return {
        ability,
        proficient,
        bonus,
      };
    });

    const inventory = await this.inventoryService.getInventory(characterId);
    const inventoryMapped = inventory.map(entry => ({
      id: entry.id,
      equipped: entry.equipped,
      item: {
        id: entry.item.id,
        name: entry.item.name,
        description: entry.item.description,
        slot: entry.item.slot,
      },
    }));
    const equippedItems = inventoryMapped.filter(entry => entry.equipped);

    // Build the response object
    return {
      character: {
        id: character.id,
        name: character.name,
        level: character.level,
        class: {
          id: character.class.id,
          name: character.class.name,
          contentSource: character.class.contentSource.name,
        },
        race: character.race
          ? {
              id: character.race.id,
              name: character.race.name,
              contentSource: character.race.contentSource.name,
            }
          : null,
        background: character.background
          ? {
              id: character.background.id,
              name: character.background.name,
              contentSource: character.background.contentSource.name,
            }
          : null,
        abilityScores: baseAbilityScores,
      },
      features: allGrantedFeatures,
      requiredChoices: requiredChoices.map(choice => ({
        id: choice.id,
        sourceType: choice.sourceType,
        chooseCount: choice.chooseCount,
        options: choice.optionsJson,
      })),
      selectedChoices: selectedChoices.map(sc => ({
        choiceId: sc.choiceId,
        selectedOption: sc.selectedOption,
        choiceName: sc.choice.sourceType,
      })),
      missingChoices: missingChoices.map(choice => ({
        id: choice.id,
        sourceType: choice.sourceType,
        chooseCount: choice.chooseCount,
        options: choice.optionsJson,
      })),
      inventory: inventoryMapped,
      equippedItems,
      modifiers,
      abilityScores: {
        base: baseAbilityScores,
        effective: effectiveAbilityScores,
      },
      derivedStats: {
        abilityModifiers,
        armorClass,
        attackBonus,
        proficiencyBonus,
        initiative,
        passive: {
          perception: passivePerception,
          investigation: passiveInvestigation,
          insight: passiveInsight,
        },
      },
      skills: computedSkills,
      savingThrows,
    };
  }
}
