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
        armorClass: template.armorClass,
        maxHp: template.maxHp,
        initiativeModifier: template.initiativeModifier,
        challengeRating: template.challengeRating,
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
      armorClass: number;
      maxHp: number;
      initiativeModifier?: number;
      challengeRating?: string;
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

    const created = await this.prisma.monsterTemplate.create({
      data: {
        name,
        armorClass: input.armorClass,
        maxHp: input.maxHp,
        initiativeModifier,
        challengeRating: input.challengeRating?.trim() || null,
        source: input.source?.trim() || null,
        scope,
        ownerUserId: scope === 'PERSONAL' ? user.id : null,
      },
    });

    return {
      id: created.id,
      name: created.name,
      armorClass: created.armorClass,
      maxHp: created.maxHp,
      initiativeModifier: created.initiativeModifier,
      challengeRating: created.challengeRating,
      source: created.source,
      scope: created.scope,
      ownerUserId: created.ownerUserId,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    };
  }
}

export default MonsterService;
