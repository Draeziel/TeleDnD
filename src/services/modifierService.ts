import { PrismaClient, Modifier, AbilityScoreSet } from '@prisma/client';

/**
 * Provides read-only aggregation helpers for character modifiers.
 * Future expansion can plug in additional source types (items, effects, etc.).
 */
export class ModifierService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Collect modifiers granted to a character by their earned features.
   * At this stage we only aggregate the definitions without applying them.
   */
  async getCharacterModifiers(characterId: string): Promise<Modifier[]> {
    const character = await this.prisma.character.findUnique({
      where: { id: characterId },
      select: {
        id: true,
        level: true,
        classId: true,
        raceId: true,
        backgroundId: true,
      },
    });

    if (!character) {
      throw new Error(`Character with ID ${characterId} not found`);
    }

    const featureIds = new Set<string>();

    // Class features unlocked up to the character's current level.
    const classFeatures = await this.prisma.classFeature.findMany({
      where: {
        classId: character.classId,
        levelRequired: {
          lte: character.level,
        },
      },
      select: {
        featureId: true,
      },
    });
    classFeatures.forEach(cf => featureIds.add(cf.featureId));

    // Race features, if a race is chosen.
    if (character.raceId) {
      const raceFeatures = await this.prisma.raceFeature.findMany({
        where: { raceId: character.raceId },
        select: { featureId: true },
      });
      raceFeatures.forEach(rf => featureIds.add(rf.featureId));
    }

    // Background features, if a background is chosen.
    if (character.backgroundId) {
      const backgroundFeatures = await this.prisma.backgroundFeature.findMany({
        where: { backgroundId: character.backgroundId },
        select: { featureId: true },
      });
      backgroundFeatures.forEach(bf => featureIds.add(bf.featureId));
    }

    const equippedItems = await this.prisma.characterItem.findMany({
      where: {
        characterId,
        equipped: true,
      },
      select: {
        itemId: true,
      },
    });

    const sourceIds: string[] = [];

    if (featureIds.size > 0) {
      sourceIds.push(...featureIds);
    }

    if (equippedItems.length > 0) {
      sourceIds.push(
        ...equippedItems.map(item => item.itemId)
      );
    }

    if (sourceIds.length === 0) {
      return [];
    }

    return await this.prisma.modifier.findMany({
      where: {
        OR: [
          {
            sourceType: 'feature',
            sourceId: {
              in: Array.from(featureIds),
            },
          },
          {
            sourceType: 'item',
            sourceId: {
              in: equippedItems.map(item => item.itemId),
            },
          },
        ],
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  /**
   * Apply ability score modifiers to a base ability score set without mutating the original.
   * Only operations targeting abilities are considered; other modifier types are ignored.
   */
  applyAbilityModifiers(baseScores: AbilityScoreSet, modifiers: Modifier[]): AbilityScoreSet {
    if (!baseScores) {
      throw new Error('baseScores are required to apply ability modifiers');
    }

    if (!modifiers || modifiers.length === 0) {
      return { ...baseScores };
    }

    const abilityKeys = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
    const computed = { ...baseScores } as AbilityScoreSet;

    const abilityModifiers = modifiers.filter(mod => mod.target === 'ability');
    const addModifiers = abilityModifiers.filter(mod => mod.operation === 'add');
    const setModifiers = abilityModifiers.filter(mod => mod.operation === 'set');

    const apply = (mods: Modifier[]) => {
      for (const modifier of mods) {
        const normalizedKey = modifier.targetKey?.toLowerCase() ?? 'all';
        const targetKeys =
          normalizedKey === 'all'
            ? abilityKeys
            : abilityKeys.filter(key => key === normalizedKey);

        if (targetKeys.length === 0 || modifier.value === null || modifier.value === undefined) {
          continue;
        }

        for (const key of targetKeys) {
          if (modifier.operation === 'set') {
            (computed as any)[key] = modifier.value;
          } else if (modifier.operation === 'add') {
            const current = (computed as any)[key] ?? 0;
            (computed as any)[key] = current + modifier.value;
          }
        }
      }
    };

    apply(addModifiers);
    apply(setModifiers);

    return computed;
  }
}

export default ModifierService;
