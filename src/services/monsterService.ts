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
  statusType?: 'DAMAGE' | 'CONTROL' | 'DEBUFF';
  statusElement?: 'FIRE' | 'POISON' | 'PHYSICAL';
  rounds?: number;
  damageDiceCount?: number;
  damageDiceSides?: number;
  saveDiceCount?: number;
  saveDiceSides?: number;
  saveOperator?: '<' | '<=' | '=' | '>=' | '>';
  saveTargetValue?: number;
  saveDamagePercent?: 0 | 50 | 100 | 200;
  colorHex?: string;
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
    const statusType = String(input.statusType || 'DAMAGE').toUpperCase();
    const statusElement = String(input.statusElement || 'POISON').toUpperCase();

    if (!name || name.length < 2 || name.length > 80) {
      throw new Error('Validation: status template name length must be between 2 and 80 characters');
    }

    if (statusType !== 'DAMAGE' && statusType !== 'CONTROL' && statusType !== 'DEBUFF') {
      throw new Error('Validation: statusType must be DAMAGE, CONTROL, or DEBUFF');
    }

    if (statusElement !== 'FIRE' && statusElement !== 'POISON' && statusElement !== 'PHYSICAL') {
      throw new Error('Validation: statusElement must be FIRE, POISON, or PHYSICAL');
    }

    const rounds = Number.isInteger(input.rounds) ? Number(input.rounds) : 3;
    if (rounds < 1 || rounds > 20) {
      throw new Error('Validation: rounds must be an integer in range 1..20');
    }

    const damageDiceCount = Number.isInteger(input.damageDiceCount) ? Number(input.damageDiceCount) : 1;
    const damageDiceSides = Number.isInteger(input.damageDiceSides) ? Number(input.damageDiceSides) : 6;
    const saveDiceCount = Number.isInteger(input.saveDiceCount) ? Number(input.saveDiceCount) : 1;
    const saveDiceSides = Number.isInteger(input.saveDiceSides) ? Number(input.saveDiceSides) : 12;
    const saveTargetValue = Number.isInteger(input.saveTargetValue) ? Number(input.saveTargetValue) : 10;
    const saveOperator = (input.saveOperator || '>=').trim() as '<' | '<=' | '=' | '>=' | '>';
    const saveDamagePercent = [0, 50, 100, 200].includes(Number(input.saveDamagePercent))
      ? Number(input.saveDamagePercent) as 0 | 50 | 100 | 200
      : 50;

    if (damageDiceCount < 1 || damageDiceCount > 20) {
      throw new Error('Validation: damageDiceCount must be an integer in range 1..20');
    }

    if (damageDiceSides < 2 || damageDiceSides > 100) {
      throw new Error('Validation: damageDiceSides must be an integer in range 2..100');
    }

    if (saveDiceCount < 1 || saveDiceCount > 20) {
      throw new Error('Validation: saveDiceCount must be an integer in range 1..20');
    }

    if (saveDiceSides < 2 || saveDiceSides > 100) {
      throw new Error('Validation: saveDiceSides must be an integer in range 2..100');
    }

    if (saveTargetValue < 1 || saveTargetValue > 200) {
      throw new Error('Validation: saveTargetValue must be an integer in range 1..200');
    }

    if (!['<', '<=', '=', '>=', '>'].includes(saveOperator)) {
      throw new Error('Validation: saveOperator must be one of <, <=, =, >=, >');
    }

    const colorHex = String(input.colorHex || '#5b9cff').trim();
    if (!/^#([0-9a-fA-F]{6})$/.test(colorHex)) {
      throw new Error('Validation: colorHex must be a valid hex color like #5b9cff');
    }

    const effectType = `${statusType.toLowerCase()}_${statusElement.toLowerCase()}`;

    const payload = {
      meta: {
        statusType,
        statusElement,
        colorHex,
      },
      ...(statusType === 'DAMAGE'
        ? {
            automation: {
              kind: 'POISON_TICK',
              trigger: 'TURN_START',
              damage: {
                mode: 'dice',
                count: damageDiceCount,
                sides: damageDiceSides,
                bonus: 0,
              },
              roundsLeft: rounds,
              save: {
                ability: 'con',
                check: {
                  count: saveDiceCount,
                  sides: saveDiceSides,
                  operator: saveOperator,
                  target: saveTargetValue,
                },
                damagePercentOnMatch: saveDamagePercent,
              },
            },
          }
        : {}),
    };

    return {
      name,
      effectType,
      defaultDuration: String(rounds),
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
    const check = save.check && typeof save.check === 'object'
      ? save.check as Record<string, unknown>
      : {};
    const meta = existing.payload?.meta && typeof existing.payload.meta === 'object'
      ? existing.payload.meta as Record<string, unknown>
      : {};

    return {
      name: existing.name,
      statusType: String(meta.statusType || (automation.kind ? 'DAMAGE' : 'CONTROL')).toUpperCase() as 'DAMAGE' | 'CONTROL' | 'DEBUFF',
      statusElement: String(meta.statusElement || 'POISON').toUpperCase() as 'FIRE' | 'POISON' | 'PHYSICAL',
      rounds: Number(automation.roundsLeft ?? 3),
      damageDiceCount: Number(damage.count ?? 1),
      damageDiceSides: Number(damage.sides ?? 6),
      saveDiceCount: Number(check.count ?? 1),
      saveDiceSides: Number(check.sides ?? save.dieSides ?? 12),
      saveOperator: String(check.operator || '>=' ) as '<' | '<=' | '=' | '>=' | '>',
      saveTargetValue: Number(check.target ?? save.threshold ?? save.dc ?? 10),
      saveDamagePercent: Number(save.damagePercentOnMatch ?? (save.halfOnSave === false ? 0 : 50)) as 0 | 50 | 100 | 200,
      colorHex: String(meta.colorHex || '#5b9cff'),
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
      statusType: input.statusType ?? fromPayload.statusType,
      statusElement: input.statusElement ?? fromPayload.statusElement,
      isActive: input.isActive ?? fromPayload.isActive,
      damageDiceCount: (input as any).damageDiceCount ?? fromPayload.damageDiceCount,
      damageDiceSides: (input as any).damageDiceSides ?? fromPayload.damageDiceSides,
      saveDiceCount: (input as any).saveDiceCount ?? fromPayload.saveDiceCount,
      saveDiceSides: (input as any).saveDiceSides ?? fromPayload.saveDiceSides,
      saveOperator: (input as any).saveOperator ?? fromPayload.saveOperator,
      saveTargetValue: (input as any).saveTargetValue ?? fromPayload.saveTargetValue,
      saveDamagePercent: (input as any).saveDamagePercent ?? fromPayload.saveDamagePercent,
      colorHex: (input as any).colorHex ?? fromPayload.colorHex,
      rounds: (input as any).rounds ?? fromPayload.rounds,
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
