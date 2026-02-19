import { PrismaClient } from '@prisma/client';
import { isTelegramAdmin } from '../utils/admin';

export class MonsterService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  private async resolveUserByTelegramId(telegramUserId: string) {
    return this.prisma.user.upsert({
      where: { telegramId: telegramUserId },
      update: {},
      create: { telegramId: telegramUserId },
    });
  }

  async listTemplates(telegramUserId: string, query?: string, scope?: string) {
    const user = await this.resolveUserByTelegramId(telegramUserId);
    const normalizedQuery = query?.trim();
    const normalizedScope = (scope || 'all').toLowerCase();

    const scopeFilter =
      normalizedScope === 'global'
        ? { scope: 'GLOBAL' as const }
        : normalizedScope === 'personal'
          ? { scope: 'PERSONAL' as const, ownerUserId: user.id }
          : {
              OR: [
                { scope: 'GLOBAL' as const },
                { scope: 'PERSONAL' as const, ownerUserId: user.id },
              ],
            };

    const templates = await this.prisma.monsterTemplate.findMany({
      where: {
        ...scopeFilter,
        ...(normalizedQuery
          ? {
              name: {
                contains: normalizedQuery,
                mode: 'insensitive',
              },
            }
          : {}),
      },
      orderBy: [
        { scope: 'asc' },
        { name: 'asc' },
      ],
    });

    return {
      canManageGlobal: isTelegramAdmin(telegramUserId),
      items: templates.map((template) => ({
        id: template.id,
        name: template.name,
        size: template.size,
        creatureType: template.creatureType,
        alignment: template.alignment,
        armorClass: template.armorClass,
        maxHp: template.maxHp,
        hitDice: template.hitDice,
        speed: template.speed,
        strength: template.strength,
        dexterity: template.dexterity,
        constitution: template.constitution,
        intelligence: template.intelligence,
        wisdom: template.wisdom,
        charisma: template.charisma,
        initiativeModifier: template.initiativeModifier,
        challengeRating: template.challengeRating,
        damageImmunities: template.damageImmunities,
        conditionImmunities: template.conditionImmunities,
        senses: template.senses,
        languages: template.languages,
        traits: template.traits,
        actions: template.actions,
        legendaryActions: template.legendaryActions,
        iconUrl: template.iconUrl,
        imageUrl: template.imageUrl,
        source: template.source,
        scope: template.scope,
        ownerUserId: template.ownerUserId,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt,
      })),
    };
  }

  async createTemplate(
    telegramUserId: string,
    input: {
      name: string;
      size?: string;
      creatureType?: string;
      alignment?: string;
      armorClass: number;
      maxHp: number;
      hitDice?: string;
      speed?: string;
      strength?: number;
      dexterity?: number;
      constitution?: number;
      intelligence?: number;
      wisdom?: number;
      charisma?: number;
      initiativeModifier?: number;
      challengeRating?: string;
      damageImmunities?: string;
      conditionImmunities?: string;
      senses?: string;
      languages?: string;
      traits?: string;
      actions?: string;
      legendaryActions?: string;
      iconUrl?: string;
      imageUrl?: string;
      source?: string;
      scope?: string;
    }
  ) {
    const user = await this.resolveUserByTelegramId(telegramUserId);

    const name = input.name?.trim();
    if (!name || name.length < 2 || name.length > 80) {
      throw new Error('Validation: name length must be between 2 and 80 characters');
    }

    if (!Number.isInteger(input.armorClass) || input.armorClass < 0 || input.armorClass > 40) {
      throw new Error('Validation: armorClass must be an integer in range 0..40');
    }

    if (!Number.isInteger(input.maxHp) || input.maxHp < 1 || input.maxHp > 9999) {
      throw new Error('Validation: maxHp must be an integer in range 1..9999');
    }

    const initiativeModifier = input.initiativeModifier ?? 0;
    if (!Number.isInteger(initiativeModifier) || initiativeModifier < -20 || initiativeModifier > 20) {
      throw new Error('Validation: initiativeModifier must be an integer in range -20..20');
    }

    const scope = (input.scope || 'PERSONAL').toUpperCase();
    if (scope !== 'PERSONAL' && scope !== 'GLOBAL') {
      throw new Error('Validation: scope must be PERSONAL or GLOBAL');
    }

    if (scope === 'GLOBAL' && !isTelegramAdmin(telegramUserId)) {
      throw new Error('Forbidden: admin role required for GLOBAL monster templates');
    }

    const validateAbility = (value: number | undefined, key: string) => {
      if (value === undefined) {
        return 10;
      }

      if (!Number.isInteger(value) || value < 1 || value > 30) {
        throw new Error(`Validation: ${key} must be an integer in range 1..30`);
      }

      return value;
    };

    const strength = validateAbility(input.strength, 'strength');
    const dexterity = validateAbility(input.dexterity, 'dexterity');
    const constitution = validateAbility(input.constitution, 'constitution');
    const intelligence = validateAbility(input.intelligence, 'intelligence');
    const wisdom = validateAbility(input.wisdom, 'wisdom');
    const charisma = validateAbility(input.charisma, 'charisma');

    const created = await this.prisma.monsterTemplate.create({
      data: {
        name,
        size: input.size?.trim() || null,
        creatureType: input.creatureType?.trim() || null,
        alignment: input.alignment?.trim() || null,
        armorClass: input.armorClass,
        maxHp: input.maxHp,
        hitDice: input.hitDice?.trim() || null,
        speed: input.speed?.trim() || null,
        strength,
        dexterity,
        constitution,
        intelligence,
        wisdom,
        charisma,
        initiativeModifier,
        challengeRating: input.challengeRating?.trim() || null,
        damageImmunities: input.damageImmunities?.trim() || null,
        conditionImmunities: input.conditionImmunities?.trim() || null,
        senses: input.senses?.trim() || null,
        languages: input.languages?.trim() || null,
        traits: input.traits?.trim() || null,
        actions: input.actions?.trim() || null,
        legendaryActions: input.legendaryActions?.trim() || null,
        iconUrl: input.iconUrl?.trim() || null,
        imageUrl: input.imageUrl?.trim() || null,
        source: input.source?.trim() || null,
        scope,
        ownerUserId: scope === 'PERSONAL' ? user.id : null,
      },
    });

    return {
      id: created.id,
      name: created.name,
      size: created.size,
      creatureType: created.creatureType,
      alignment: created.alignment,
      armorClass: created.armorClass,
      maxHp: created.maxHp,
      hitDice: created.hitDice,
      speed: created.speed,
      strength: created.strength,
      dexterity: created.dexterity,
      constitution: created.constitution,
      intelligence: created.intelligence,
      wisdom: created.wisdom,
      charisma: created.charisma,
      initiativeModifier: created.initiativeModifier,
      challengeRating: created.challengeRating,
      damageImmunities: created.damageImmunities,
      conditionImmunities: created.conditionImmunities,
      senses: created.senses,
      languages: created.languages,
      traits: created.traits,
      actions: created.actions,
      legendaryActions: created.legendaryActions,
      iconUrl: created.iconUrl,
      imageUrl: created.imageUrl,
      source: created.source,
      scope: created.scope,
      ownerUserId: created.ownerUserId,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    };
  }
}

export default MonsterService;
