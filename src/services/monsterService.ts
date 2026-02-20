import { PrismaClient } from '@prisma/client';
import { isTelegramAdmin } from '../utils/admin';

type MonsterTemplateInput = {
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
};

type StatusTemplateInput = {
  name: string;
  effectType: string;
  defaultDuration: string;
  damageMode?: 'flat' | 'dice';
  damageFlat?: number;
  damageCount?: number;
  damageSides?: number;
  damageBonus?: number;
  rounds?: number;
  saveDieSides?: number;
  saveThreshold?: number;
  halfOnSave?: boolean;
  isActive?: boolean;
};

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

  private serializeTemplate(template: any) {
    return {
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
    };
  }

  private serializeStatusTemplate(template: any) {
    return {
      id: template.id,
      key: template.key,
      name: template.name,
      effectType: template.effectType,
      defaultDuration: template.defaultDuration,
      payload: template.payload,
      isActive: template.isActive,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    };
  }

  private normalizeStatusTemplateKey(name: string) {
    const base = name
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-zа-я0-9_]/gi, '')
      .slice(0, 40);

    const suffix = Math.random().toString(36).slice(2, 8);
    return `${base || 'status'}_${suffix}`;
  }

  private prepareStatusTemplateData(input: StatusTemplateInput) {
    const name = String(input.name || '').trim();
    const effectType = String(input.effectType || '').trim();
    const defaultDuration = String(input.defaultDuration || '').trim();

    if (!name || name.length < 2 || name.length > 80) {
      throw new Error('Validation: status template name length must be between 2 and 80 characters');
    }

    if (!effectType || effectType.length < 2 || effectType.length > 60) {
      throw new Error('Validation: effectType length must be between 2 and 60 characters');
    }

    if (!defaultDuration || defaultDuration.length < 1 || defaultDuration.length > 60) {
      throw new Error('Validation: defaultDuration length must be between 1 and 60 characters');
    }

    const rounds = Number.isInteger(input.rounds) ? Number(input.rounds) : 3;
    if (rounds < 1 || rounds > 20) {
      throw new Error('Validation: rounds must be an integer in range 1..20');
    }

    const damageMode = input.damageMode === 'flat' ? 'flat' : 'dice';
    const damageFlat = Number.isInteger(input.damageFlat) ? Number(input.damageFlat) : 1;
    const damageCount = Number.isInteger(input.damageCount) ? Number(input.damageCount) : 1;
    const damageSides = Number.isInteger(input.damageSides) ? Number(input.damageSides) : 6;
    const damageBonus = Number.isInteger(input.damageBonus) ? Number(input.damageBonus) : 0;

    if (damageMode === 'flat' && (damageFlat < 1 || damageFlat > 100)) {
      throw new Error('Validation: damageFlat must be an integer in range 1..100');
    }

    if (damageMode === 'dice') {
      if (damageCount < 1 || damageCount > 20) {
        throw new Error('Validation: damageCount must be an integer in range 1..20');
      }

      if (damageSides < 2 || damageSides > 100) {
        throw new Error('Validation: damageSides must be an integer in range 2..100');
      }

      if (damageBonus < -100 || damageBonus > 100) {
        throw new Error('Validation: damageBonus must be an integer in range -100..100');
      }
    }

    const saveDieSides = Number.isInteger(input.saveDieSides) ? Number(input.saveDieSides) : 12;
    const saveThreshold = Number.isInteger(input.saveThreshold) ? Number(input.saveThreshold) : 10;

    if (saveDieSides < 2 || saveDieSides > 100) {
      throw new Error('Validation: saveDieSides must be an integer in range 2..100');
    }

    if (saveThreshold < 1 || saveThreshold > 100) {
      throw new Error('Validation: saveThreshold must be an integer in range 1..100');
    }

    const payload = {
      automation: {
        kind: 'POISON_TICK',
        trigger: 'TURN_START',
        ...(damageMode === 'flat'
          ? {
              damagePerTick: damageFlat,
            }
          : {
              damage: {
                mode: 'dice',
                count: damageCount,
                sides: damageSides,
                bonus: damageBonus,
              },
            }),
        roundsLeft: rounds,
        save: {
          ability: 'con',
          dieSides: saveDieSides,
          threshold: saveThreshold,
          dc: saveThreshold,
          halfOnSave: input.halfOnSave === undefined ? true : Boolean(input.halfOnSave),
        },
      },
    };

    return {
      name,
      effectType,
      defaultDuration,
      payload,
      isActive: input.isActive === undefined ? true : Boolean(input.isActive),
    };
  }

  private extractStatusTemplateInputFromPayload(existing: {
    name: string;
    effectType: string;
    defaultDuration: string;
    isActive: boolean;
    payload: any;
  }): StatusTemplateInput {
    const automation = existing.payload?.automation && typeof existing.payload.automation === 'object'
      ? existing.payload.automation as Record<string, unknown>
      : {};
    const damage = automation.damage && typeof automation.damage === 'object'
      ? automation.damage as Record<string, unknown>
      : {};
    const save = automation.save && typeof automation.save === 'object'
      ? automation.save as Record<string, unknown>
      : {};

    const damageMode = String(damage.mode || '').toLowerCase() === 'dice' ? 'dice' : 'flat';

    return {
      name: existing.name,
      effectType: existing.effectType,
      defaultDuration: existing.defaultDuration,
      damageMode,
      damageFlat: Number(automation.damagePerTick ?? 1),
      damageCount: Number(damage.count ?? 1),
      damageSides: Number(damage.sides ?? 6),
      damageBonus: Number(damage.bonus ?? 0),
      rounds: Number(automation.roundsLeft ?? 3),
      saveDieSides: Number(save.dieSides ?? 12),
      saveThreshold: Number(save.threshold ?? save.dc ?? 10),
      halfOnSave: save.halfOnSave === undefined ? true : Boolean(save.halfOnSave),
      isActive: existing.isActive,
    };
  }

  private prepareTemplateData(telegramUserId: string, input: MonsterTemplateInput) {
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

    return {
      name,
      size: input.size?.trim() || null,
      creatureType: input.creatureType?.trim() || null,
      alignment: input.alignment?.trim() || null,
      armorClass: input.armorClass,
      maxHp: input.maxHp,
      hitDice: input.hitDice?.trim() || null,
      speed: input.speed?.trim() || null,
      strength: validateAbility(input.strength, 'strength'),
      dexterity: validateAbility(input.dexterity, 'dexterity'),
      constitution: validateAbility(input.constitution, 'constitution'),
      intelligence: validateAbility(input.intelligence, 'intelligence'),
      wisdom: validateAbility(input.wisdom, 'wisdom'),
      charisma: validateAbility(input.charisma, 'charisma'),
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
    };
  }

  private assertManageTemplateAccess(telegramUserId: string, userId: string, template: { scope: string; ownerUserId: string | null }) {
    if (template.scope === 'GLOBAL') {
      if (!isTelegramAdmin(telegramUserId)) {
        throw new Error('Forbidden: admin role required for GLOBAL monster templates');
      }
      return;
    }

    if (template.ownerUserId !== userId) {
      throw new Error('Forbidden: you can manage only your PERSONAL monster templates');
    }
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
      items: templates.map((template) => this.serializeTemplate(template)),
    };
  }

  async createTemplate(telegramUserId: string, input: MonsterTemplateInput) {
    const user = await this.resolveUserByTelegramId(telegramUserId);
    const data = this.prepareTemplateData(telegramUserId, input);

    const created = await this.prisma.monsterTemplate.create({
      data: {
        ...data,
        ownerUserId: data.scope === 'PERSONAL' ? user.id : null,
      },
    });

    return this.serializeTemplate(created);
  }

  async updateTemplate(telegramUserId: string, templateId: string, input: MonsterTemplateInput) {
    const user = await this.resolveUserByTelegramId(telegramUserId);

    const existing = await this.prisma.monsterTemplate.findUnique({
      where: { id: templateId },
      select: {
        id: true,
        scope: true,
        ownerUserId: true,
      },
    });

    if (!existing) {
      throw new Error('Monster template not found');
    }

    this.assertManageTemplateAccess(telegramUserId, user.id, existing);

    const data = this.prepareTemplateData(telegramUserId, input);
    if (existing.scope === 'PERSONAL') {
      data.scope = 'PERSONAL';
    }

    const updated = await this.prisma.monsterTemplate.update({
      where: { id: existing.id },
      data: {
        ...data,
        ownerUserId: data.scope === 'PERSONAL' ? user.id : null,
      },
    });

    return this.serializeTemplate(updated);
  }

  async deleteTemplate(telegramUserId: string, templateId: string) {
    const user = await this.resolveUserByTelegramId(telegramUserId);

    const existing = await this.prisma.monsterTemplate.findUnique({
      where: { id: templateId },
      select: {
        id: true,
        scope: true,
        ownerUserId: true,
      },
    });

    if (!existing) {
      throw new Error('Monster template not found');
    }

    this.assertManageTemplateAccess(telegramUserId, user.id, existing);

    await this.prisma.monsterTemplate.delete({ where: { id: existing.id } });

    return {
      success: true,
      id: existing.id,
    };
  }

  async listStatusTemplates(telegramUserId: string) {
    await this.resolveUserByTelegramId(telegramUserId);

    const items = await this.prisma.statusTemplate.findMany({
      orderBy: [
        { isActive: 'desc' },
        { name: 'asc' },
      ],
    });

    return {
      items: items.map((item) => this.serializeStatusTemplate(item)),
    };
  }

  async createStatusTemplate(telegramUserId: string, input: StatusTemplateInput) {
    await this.resolveUserByTelegramId(telegramUserId);
    const data = this.prepareStatusTemplateData(input);

    const created = await this.prisma.statusTemplate.create({
      data: {
        key: this.normalizeStatusTemplateKey(data.name),
        name: data.name,
        effectType: data.effectType,
        defaultDuration: data.defaultDuration,
        payload: data.payload,
        isActive: data.isActive,
      },
    });

    return this.serializeStatusTemplate(created);
  }

  async updateStatusTemplate(telegramUserId: string, id: string, input: Partial<StatusTemplateInput>) {
    await this.resolveUserByTelegramId(telegramUserId);

    const existing = await this.prisma.statusTemplate.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new Error('Status template not found');
    }

    const fromPayload = this.extractStatusTemplateInputFromPayload(existing);

    const merged = {
      name: input.name ?? fromPayload.name,
      effectType: input.effectType ?? fromPayload.effectType,
      defaultDuration: input.defaultDuration ?? fromPayload.defaultDuration,
      isActive: input.isActive ?? fromPayload.isActive,
      damageMode: ((input as any).damageMode ?? fromPayload.damageMode) as 'flat' | 'dice',
      damageFlat: (input as any).damageFlat ?? fromPayload.damageFlat,
      damageCount: (input as any).damageCount ?? fromPayload.damageCount,
      damageSides: (input as any).damageSides ?? fromPayload.damageSides,
      damageBonus: (input as any).damageBonus ?? fromPayload.damageBonus,
      rounds: (input as any).rounds ?? fromPayload.rounds,
      saveDieSides: (input as any).saveDieSides ?? fromPayload.saveDieSides,
      saveThreshold: (input as any).saveThreshold ?? fromPayload.saveThreshold,
      halfOnSave: (input as any).halfOnSave ?? fromPayload.halfOnSave,
    } as StatusTemplateInput;

    const data = this.prepareStatusTemplateData(merged);

    const updated = await this.prisma.statusTemplate.update({
      where: { id },
      data: {
        name: data.name,
        effectType: data.effectType,
        defaultDuration: data.defaultDuration,
        payload: data.payload,
        isActive: data.isActive,
      },
    });

    return this.serializeStatusTemplate(updated);
  }

  async deleteStatusTemplate(telegramUserId: string, id: string) {
    await this.resolveUserByTelegramId(telegramUserId);

    const existing = await this.prisma.statusTemplate.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      throw new Error('Status template not found');
    }

    await this.prisma.statusTemplate.delete({ where: { id: existing.id } });
    return { success: true, id: existing.id };
  }
}

export default MonsterService;
