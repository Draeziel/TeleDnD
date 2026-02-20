import { PrismaClient, Prisma } from '@prisma/client';
import crypto from 'crypto';
import { CapabilityResolverService } from './capabilityResolverService';
import type { CapabilityBaseDto } from '../types';

type CombatActionType =
  | 'START_ENCOUNTER'
  | 'NEXT_TURN'
  | 'END_ENCOUNTER'
  | 'UNDO_LAST'
  | 'SET_CHARACTER_HP'
  | 'SET_MONSTER_HP'
  | 'SET_CHARACTER_INITIATIVE'
  | 'ROLL_INITIATIVE_CHARACTERS'
  | 'ROLL_INITIATIVE_MONSTERS'
  | 'ROLL_INITIATIVE_SELF'
  | 'LOCK_INITIATIVE'
  | 'UNLOCK_INITIATIVE'
  | 'RESET_INITIATIVE'
  | 'APPLY_CHARACTER_EFFECT'
  | 'APPLY_MONSTER_EFFECT'
  | 'REMOVE_CHARACTER_EFFECT'
  | 'REMOVE_MONSTER_EFFECT'
  | 'OPEN_REACTION_WINDOW'
  | 'RESPOND_REACTION_WINDOW';

type CombatActionPayload = {
  characterId?: string;
  monsterId?: string;
  currentHp?: number;
  initiative?: number;
  tempHp?: number | null;
  effectType?: string;
  effectId?: string;
  templateId?: string;
  duration?: string;
  effectPayload?: Record<string, unknown>;
  reactionId?: string;
  reactionType?: string;
  targetType?: 'character' | 'monster';
  targetRefId?: string;
  ttlSeconds?: number;
  responsePayload?: Record<string, unknown>;
};

type SaveAbility = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';

type UndoActionSnapshot =
  | {
      kind: 'character_hp';
      sessionCharacterId: string;
      characterName: string;
      previousState: {
        currentHp: number;
        maxHpSnapshot: number;
        tempHp: number | null;
        initiative: number | null;
      } | null;
    }
  | {
      kind: 'character_initiative';
      sessionCharacterId: string;
      characterName: string;
      previousState: {
        currentHp: number;
        maxHpSnapshot: number;
        tempHp: number | null;
        initiative: number | null;
      } | null;
    }
  | {
      kind: 'monster_hp';
      sessionMonsterId: string;
      monsterName: string;
      previousCurrentHp: number;
    }
  | {
      kind: 'effect_applied';
      effectId: string;
      sessionCharacterId: string;
      characterName: string;
      effectType: string;
    }
  | {
      kind: 'monster_effect_applied';
      effectId: string;
      sessionMonsterId: string;
      monsterName: string;
      effectType: string;
    }
  | {
      kind: 'effect_removed';
      effectId: string;
      sessionCharacterId: string;
      characterName: string;
      effectType: string;
      duration: string;
      payload: Prisma.JsonValue;
    }
  | {
      kind: 'monster_effect_removed';
      effectId: string;
      sessionMonsterId: string;
      monsterName: string;
      effectType: string;
      duration: string;
      payload: Prisma.JsonValue;
    };

export class SessionService {
  private prisma: PrismaClient;
  private capabilityResolverService: CapabilityResolverService;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.capabilityResolverService = new CapabilityResolverService(prisma);
  }

  private static mapCombatCapabilityAction(capability: CapabilityBaseDto) {
    const payloadName = capability.payload.name;
    const payloadDescription = capability.payload.description;
    const payloadSourceRef = capability.payload.sourceRef;

    return {
      capabilityId: capability.id,
      sourceType: capability.sourceType,
      sourceId: capability.sourceId,
      sourceRef: typeof payloadSourceRef === 'string' ? payloadSourceRef : null,
      payloadType: capability.payloadType,
      scope: capability.scope,
      timing: capability.timing,
      lifecycleState: capability.lifecycleState,
      executionIntent: capability.executionIntent,
      trigger: capability.trigger || null,
      name: typeof payloadName === 'string' ? payloadName : capability.id,
      description: typeof payloadDescription === 'string' ? payloadDescription : null,
      payload: capability.payload,
    };
  }

  private async getLatestEventSeq(sessionId: string): Promise<bigint | null> {
    const latest = await this.prisma.sessionEvent.findFirst({
      where: { sessionId },
      select: { eventSeq: true },
      orderBy: { eventSeq: 'desc' },
    });

    return latest?.eventSeq ?? null;
  }

  private async refreshCombatSnapshot(sessionId: string): Promise<void> {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        encounterActive: true,
        combatRound: true,
        activeTurnSessionCharacterId: true,
        characters: {
          select: {
            id: true,
            character: {
              select: {
                name: true,
              },
            },
            state: {
              select: {
                currentHp: true,
                maxHpSnapshot: true,
                initiative: true,
              },
            },
            _count: {
              select: {
                effects: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
        monsters: {
          select: {
            id: true,
            nameSnapshot: true,
            currentHp: true,
            maxHpSnapshot: true,
            initiative: true,
            _count: {
              select: {
                effects: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!session) {
      return;
    }

    const initiativeOrder = await this.getEncounterOrder(sessionId);

    const actors = [
      ...session.characters.map((entry) => ({
        kind: 'character',
        id: entry.id,
        name: entry.character.name,
        currentHp: entry.state?.currentHp ?? null,
        maxHpSnapshot: entry.state?.maxHpSnapshot ?? null,
        initiative: entry.state?.initiative ?? null,
        effectsCount: entry._count.effects,
      })),
      ...session.monsters.map((entry) => ({
        kind: 'monster',
        id: entry.id,
        name: entry.nameSnapshot,
        currentHp: entry.currentHp,
        maxHpSnapshot: entry.maxHpSnapshot,
        initiative: entry.initiative,
        effectsCount: entry._count.effects,
      })),
    ];

    await this.prisma.sessionCombatSnapshot.upsert({
      where: {
        sessionId,
      },
      update: {
        encounterActive: session.encounterActive,
        combatRound: session.combatRound,
        activeTurnSessionCharacterId: session.activeTurnSessionCharacterId,
        initiativeOrder: initiativeOrder as Prisma.InputJsonValue,
        actors: actors as Prisma.InputJsonValue,
      },
      create: {
        sessionId,
        encounterActive: session.encounterActive,
        combatRound: session.combatRound,
        activeTurnSessionCharacterId: session.activeTurnSessionCharacterId,
        initiativeOrder: initiativeOrder as Prisma.InputJsonValue,
        actors: actors as Prisma.InputJsonValue,
      },
    });
  }

  private async addSessionEvent(
    sessionId: string,
    type: string,
    message: string,
    actorTelegramId: string,
    eventCategory = 'GENERAL',
    payload?: Prisma.InputJsonValue
  ) {
    await this.prisma.sessionEvent.create({
      data: {
        sessionId,
        type,
        eventCategory,
        message,
        payload,
        actorTelegramId,
      },
    });

    await this.refreshCombatSnapshot(sessionId);
  }

  private async pushUndoSnapshot(sessionId: string, actorTelegramId: string, snapshot: UndoActionSnapshot) {
    await this.prisma.sessionEvent.create({
      data: {
        sessionId,
        type: 'undo_snapshot',
        message: JSON.stringify(snapshot),
        actorTelegramId,
      },
    });
  }

  private parseUndoSnapshot(rawMessage: string): UndoActionSnapshot {
    try {
      const parsed = JSON.parse(rawMessage) as UndoActionSnapshot;
      if (!parsed || typeof parsed !== 'object' || !('kind' in parsed)) {
        throw new Error('Invalid undo payload');
      }

      return parsed;
    } catch {
      throw new Error('Validation: invalid undo snapshot payload');
    }
  }

  private async getSessionEvents(sessionId: string, limit = 100, afterEventSeq?: bigint) {
    const safeLimit = Number.isInteger(limit) ? Math.min(Math.max(limit, 1), 100) : 100;

    const events = await this.prisma.sessionEvent.findMany({
      where: {
        sessionId,
        type: {
          notIn: ['undo_snapshot'],
        },
        ...(afterEventSeq !== undefined ? { eventSeq: { gt: afterEventSeq } } : {}),
      },
      orderBy: {
        eventSeq: afterEventSeq !== undefined ? 'asc' : 'desc',
      },
      take: safeLimit,
    });

    return events.map((event) => ({
      id: event.id,
      eventSeq: event.eventSeq.toString(),
      type: event.type,
      eventCategory: event.eventCategory,
      message: event.message,
      payload: event.payload,
      actorTelegramId: event.actorTelegramId,
      createdAt: event.createdAt,
    }));
  }

  private async ensureInitiativeUnlocked(sessionId: string) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      select: { initiativeLocked: true },
    });

    if (!session) {
      throw new Error('Session not found');
    }

    if (session.initiativeLocked) {
      throw new Error('Forbidden: initiative is locked for this session');
    }
  }

  private async getEncounterOrder(sessionId: string): Promise<string[]> {
    const [characterEntries, monsterEntries] = await Promise.all([
      this.prisma.sessionCharacter.findMany({
        where: { sessionId },
        select: {
          id: true,
          character: {
            select: {
              name: true,
            },
          },
          state: {
            select: {
              initiative: true,
            },
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
      }),
      this.prisma.sessionMonster.findMany({
        where: { sessionId },
        select: {
          id: true,
          nameSnapshot: true,
          initiative: true,
        },
        orderBy: {
          createdAt: 'asc',
        },
      }),
    ]);

    return [
      ...characterEntries
        .filter((entry) => entry.state?.initiative !== null && entry.state?.initiative !== undefined)
        .map((entry) => ({
          id: entry.id,
          name: entry.character.name,
          initiative: entry.state?.initiative ?? -999,
        })),
      ...monsterEntries
        .filter((entry) => entry.initiative !== null && entry.initiative !== undefined)
        .map((entry) => ({
          id: entry.id,
          name: entry.nameSnapshot,
          initiative: entry.initiative ?? -999,
        })),
    ]
      .sort((left, right) => {
        if (right.initiative !== left.initiative) {
          return right.initiative - left.initiative;
        }

        return left.name.localeCompare(right.name);
      })
      .map((entry) => entry.id);
  }

  private async syncEncounterTurnPointer(sessionId: string): Promise<void> {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        encounterActive: true,
        combatRound: true,
        activeTurnSessionCharacterId: true,
      },
    });

    if (!session || !session.encounterActive) {
      return;
    }

    const order = await this.getEncounterOrder(sessionId);
    if (order.length === 0) {
      await this.prisma.session.update({
        where: { id: sessionId },
        data: {
          encounterActive: false,
          combatRound: 1,
          activeTurnSessionCharacterId: null,
        },
      });
      return;
    }

    if (!session.activeTurnSessionCharacterId || !order.includes(session.activeTurnSessionCharacterId)) {
      await this.prisma.session.update({
        where: { id: sessionId },
        data: {
          activeTurnSessionCharacterId: order[0],
          combatRound: Math.max(session.combatRound, 1),
        },
      });
    }
  }

  private async resolveUserByTelegramId(telegramUserId: string) {
    return this.prisma.user.upsert({
      where: { telegramId: telegramUserId },
      update: {},
      create: { telegramId: telegramUserId },
    });
  }

  private async getMembership(sessionId: string, userId: string) {
    return this.prisma.sessionPlayer.findUnique({
      where: {
        sessionId_userId: {
          sessionId,
          userId,
        },
      },
      select: {
        role: true,
      },
    });
  }

  private async requireSessionMember(sessionId: string, userId: string) {
    const membership = await this.getMembership(sessionId, userId);
    if (!membership) {
      throw new Error('Forbidden: user is not a session member');
    }

    return membership;
  }

  private async requireSessionGM(sessionId: string, userId: string) {
    const membership = await this.requireSessionMember(sessionId, userId);
    if (membership.role !== 'GM') {
      throw new Error('Forbidden: GM role required');
    }
  }

  private validateCurrentHp(currentHp: number) {
    if (!Number.isInteger(currentHp) || currentHp < 0) {
      throw new Error('Validation: currentHp must be a non-negative integer');
    }
  }

  private validateTempHp(tempHp: number | null | undefined) {
    if (tempHp === null || tempHp === undefined) {
      return;
    }

    if (!Number.isInteger(tempHp) || tempHp < 0) {
      throw new Error('Validation: tempHp must be a non-negative integer');
    }
  }

  private validateInitiative(initiative: number) {
    if (!Number.isInteger(initiative) || initiative < -20 || initiative > 99) {
      throw new Error('Validation: initiative must be an integer in range -20..99');
    }
  }

  private dexScoreToModifier(dexScore: number | null | undefined): number {
    if (dexScore === null || dexScore === undefined) {
      return 0;
    }

    return Math.floor((dexScore - 10) / 2);
  }

  private abilityScoreToModifier(score: number | null | undefined): number {
    if (score === null || score === undefined) {
      return 0;
    }

    return Math.floor((score - 10) / 2);
  }

  private normalizeSaveAbility(raw: unknown): SaveAbility {
    const normalized = String(raw || 'con').trim().toLowerCase();
    if (normalized === 'str' || normalized === 'dex' || normalized === 'con' || normalized === 'int' || normalized === 'wis' || normalized === 'cha') {
      return normalized;
    }

    return 'con';
  }

  private pickCharacterAbilityScore(
    abilityScores: { str: number; dex: number; con: number; int: number; wis: number; cha: number } | null | undefined,
    ability: SaveAbility
  ): number | null {
    if (!abilityScores) {
      return null;
    }

    return abilityScores[ability] ?? null;
  }

  private pickMonsterAbilityScore(
    abilityScores: { strength: number; dexterity: number; constitution: number; intelligence: number; wisdom: number; charisma: number } | null | undefined,
    ability: SaveAbility
  ): number | null {
    if (!abilityScores) {
      return null;
    }

    if (ability === 'str') return abilityScores.strength;
    if (ability === 'dex') return abilityScores.dexterity;
    if (ability === 'con') return abilityScores.constitution;
    if (ability === 'int') return abilityScores.intelligence;
    if (ability === 'wis') return abilityScores.wisdom;
    return abilityScores.charisma;
  }

  private rollD20(): number {
    return crypto.randomInt(1, 21);
  }

  private parsePositiveInteger(value: unknown): number | null {
    if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
      return value;
    }

    if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
      const parsed = Number(value.trim());
      if (Number.isInteger(parsed) && parsed > 0) {
        return parsed;
      }
    }

    return null;
  }

  private parseDurationRounds(duration: string): number | null {
    const match = String(duration || '').match(/(\d+)/);
    if (!match) {
      return null;
    }

    const parsed = Number(match[1]);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  private isPoisonEffectType(effectType: string): boolean {
    const normalized = String(effectType || '').trim().toLowerCase();
    if (!normalized) {
      return false;
    }

    return normalized === 'poisoned'
      || normalized === 'poisoneded'
      || normalized.includes('poison')
      || normalized.includes('отрав')
      || normalized === 'яд';
  }

  private resolvePoisonDamageConfig(automationRecord: Record<string, unknown>) {
    const rawDamage = automationRecord.damage && typeof automationRecord.damage === 'object' && !Array.isArray(automationRecord.damage)
      ? automationRecord.damage as Record<string, unknown>
      : null;

    const mode = String(rawDamage?.mode || '').toLowerCase();
    if (mode === 'dice') {
      const count = Math.min(Math.max(this.parsePositiveInteger(rawDamage?.count) ?? 1, 1), 20);
      const sides = Math.min(Math.max(this.parsePositiveInteger(rawDamage?.sides) ?? 6, 2), 100);
      const parsedBonus = Number(rawDamage?.bonus ?? 0);
      const bonus = Number.isInteger(parsedBonus) ? Math.min(Math.max(parsedBonus, -100), 100) : 0;

      return {
        mode: 'dice' as const,
        count,
        sides,
        bonus,
      };
    }

    const flat = Math.min(Math.max(this.parsePositiveInteger(automationRecord.damagePerTick) ?? 1, 1), 50);
    return {
      mode: 'flat' as const,
      value: flat,
    };
  }

  private rollDamage(config: { mode: 'flat'; value: number } | { mode: 'dice'; count: number; sides: number; bonus: number }) {
    if (config.mode === 'flat') {
      return {
        baseDamage: config.value,
        details: {
          mode: 'flat',
          value: config.value,
        },
      };
    }

    const rolls = Array.from({ length: config.count }).map(() => crypto.randomInt(1, config.sides + 1));
    const sum = rolls.reduce((acc, item) => acc + item, 0);
    const baseDamage = Math.max(sum + config.bonus, 0);

    return {
      baseDamage,
      details: {
        mode: 'dice',
        count: config.count,
        sides: config.sides,
        bonus: config.bonus,
        rolls,
        totalBeforeClamp: sum + config.bonus,
      },
    };
  }

  private evaluateSaveCondition(leftValue: number, operator: string, rightValue: number): boolean {
    if (operator === '<') {
      return leftValue < rightValue;
    }

    if (operator === '<=') {
      return leftValue <= rightValue;
    }

    if (operator === '=') {
      return leftValue === rightValue;
    }

    if (operator === '>') {
      return leftValue > rightValue;
    }

    return leftValue >= rightValue;
  }

  private normalizePoisonEffectPayload(
    effectType: string,
    duration: string,
    payload: Prisma.InputJsonValue
  ): Prisma.InputJsonValue {
    if (!this.isPoisonEffectType(effectType)) {
      return payload;
    }

    const payloadRecord = payload && typeof payload === 'object' && !Array.isArray(payload)
      ? { ...(payload as Record<string, unknown>) }
      : {};

    const automationRecord = payloadRecord.automation && typeof payloadRecord.automation === 'object' && !Array.isArray(payloadRecord.automation)
      ? { ...(payloadRecord.automation as Record<string, unknown>) }
      : {};

    const defaultRounds = this.parseDurationRounds(duration) ?? 3;
    const damageConfig = this.resolvePoisonDamageConfig(automationRecord);
    const roundsLeft = Math.min(Math.max(this.parsePositiveInteger(automationRecord.roundsLeft) ?? defaultRounds, 1), 20);
    const saveRecord = automationRecord.save && typeof automationRecord.save === 'object' && !Array.isArray(automationRecord.save)
      ? automationRecord.save as Record<string, unknown>
      : {};
    const saveThreshold = Math.min(
      Math.max(this.parsePositiveInteger(saveRecord.threshold ?? saveRecord.dc) ?? 12, 1),
      30
    );
    const saveAbility = this.normalizeSaveAbility(saveRecord.ability);
    const saveDieSides = Math.min(Math.max(this.parsePositiveInteger(saveRecord.dieSides) ?? 20, 2), 100);
    const halfOnSave = saveRecord.halfOnSave === undefined ? true : Boolean(saveRecord.halfOnSave);

    payloadRecord.automation = {
      kind: 'POISON_TICK',
      trigger: 'TURN_START',
      ...(damageConfig.mode === 'dice'
        ? {
            damage: {
              mode: 'dice',
              count: damageConfig.count,
              sides: damageConfig.sides,
              bonus: damageConfig.bonus,
            },
          }
        : {
            damagePerTick: damageConfig.value,
          }),
      roundsLeft,
      save: {
        ability: saveAbility,
        dieSides: saveDieSides,
        threshold: saveThreshold,
        dc: saveThreshold,
        halfOnSave,
      },
    };

    return payloadRecord as Prisma.InputJsonValue;
  }

  private extractPoisonTurnStartRule(
    effectType: string,
    duration: string,
    payload: Prisma.JsonValue
  ): {
    damage: { mode: 'flat'; value: number } | { mode: 'dice'; count: number; sides: number; bonus: number };
    roundsLeft: number;
    save: {
      ability: SaveAbility;
      diceCount: number;
      diceSides: number;
      operator: '<' | '<=' | '=' | '>=' | '>';
      target: number;
      damagePercentOnMatch: number;
    };
  } | null {
    const payloadRecord = payload && typeof payload === 'object' && !Array.isArray(payload)
      ? payload as Record<string, unknown>
      : {};

    const automationRecord = payloadRecord.automation && typeof payloadRecord.automation === 'object' && !Array.isArray(payloadRecord.automation)
      ? payloadRecord.automation as Record<string, unknown>
      : {};

    const automationKind = String(automationRecord.kind || '').toUpperCase();
    const isPoisonAutomation = automationKind === 'POISON_TICK';
    if (!isPoisonAutomation && !this.isPoisonEffectType(effectType)) {
      return null;
    }

    const trigger = String(automationRecord.trigger || 'TURN_START').toUpperCase();
    if (trigger !== 'TURN_START') {
      return null;
    }

    const defaultRounds = this.parseDurationRounds(duration) ?? 1;
    const damage = this.resolvePoisonDamageConfig(automationRecord);
    const roundsLeft = Math.min(Math.max(this.parsePositiveInteger(automationRecord.roundsLeft) ?? defaultRounds, 1), 20);
    const saveRecord = automationRecord.save && typeof automationRecord.save === 'object' && !Array.isArray(automationRecord.save)
      ? automationRecord.save as Record<string, unknown>
      : {};
    const checkRecord = saveRecord.check && typeof saveRecord.check === 'object' && !Array.isArray(saveRecord.check)
      ? saveRecord.check as Record<string, unknown>
      : {};

    const diceCount = Math.min(Math.max(this.parsePositiveInteger(checkRecord.count) ?? 1, 1), 20);
    const diceSides = Math.min(Math.max(this.parsePositiveInteger(checkRecord.sides ?? saveRecord.dieSides) ?? 20, 2), 100);
    const operatorRaw = String(checkRecord.operator || '>=').trim();
    const operator = ['<', '<=', '=', '>=', '>'].includes(operatorRaw)
      ? operatorRaw as '<' | '<=' | '=' | '>=' | '>'
      : '>=';
    const target = Math.min(
      Math.max(this.parsePositiveInteger(checkRecord.target ?? saveRecord.threshold ?? saveRecord.dc) ?? 12, 1),
      200
    );
    const ability = this.normalizeSaveAbility(saveRecord.ability);

    const legacyPercent = saveRecord.halfOnSave === false ? 0 : 50;
    const damagePercentOnMatch = [0, 50, 100, 200].includes(Number(saveRecord.damagePercentOnMatch))
      ? Number(saveRecord.damagePercentOnMatch)
      : legacyPercent;

    return {
      damage,
      roundsLeft,
      save: {
        ability,
        diceCount,
        diceSides,
        operator,
        target,
        damagePercentOnMatch,
      },
    };
  }

  private formatRoundsDuration(roundsLeft: number): string {
    return `${roundsLeft} раунд(ов)`;
  }

  private withUpdatedPoisonRounds(payload: Prisma.JsonValue, roundsLeft: number): Prisma.InputJsonValue {
    const payloadRecord = payload && typeof payload === 'object' && !Array.isArray(payload)
      ? { ...(payload as Record<string, unknown>) }
      : {};

    const automationRecord = payloadRecord.automation && typeof payloadRecord.automation === 'object' && !Array.isArray(payloadRecord.automation)
      ? { ...(payloadRecord.automation as Record<string, unknown>) }
      : {};

    payloadRecord.automation = {
      ...automationRecord,
      kind: 'POISON_TICK',
      trigger: 'TURN_START',
      roundsLeft,
    };

    return payloadRecord as Prisma.InputJsonValue;
  }

  private async processAutomatedStartOfTurnEffects(sessionId: string, actorId: string, actorTelegramId: string) {
    const sessionCharacter = await this.prisma.sessionCharacter.findFirst({
      where: {
        id: actorId,
        sessionId,
      },
      include: {
        character: {
          select: {
            name: true,
            abilityScores: {
              select: {
                str: true,
                dex: true,
                con: true,
                int: true,
                wis: true,
                cha: true,
              },
            },
          },
        },
        state: true,
        effects: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (sessionCharacter && sessionCharacter.state) {
      let currentHp = sessionCharacter.state.currentHp;
      let tickCount = 0;
      let totalDamage = 0;

      for (const effect of sessionCharacter.effects) {
        const rule = this.extractPoisonTurnStartRule(effect.effectType, effect.duration, effect.payload);
        if (!rule) {
          continue;
        }

        const saveRolls = Array.from({ length: rule.save.diceCount }).map(() => crypto.randomInt(1, rule.save.diceSides + 1));
        const saveRoll = saveRolls.reduce((acc, value) => acc + value, 0);
        const saveAbilityScore = this.pickCharacterAbilityScore(sessionCharacter.character.abilityScores, rule.save.ability);
        const saveModifier = this.abilityScoreToModifier(saveAbilityScore);
        const saveTotal = saveRoll + saveModifier;
        const saveConditionMatched = this.evaluateSaveCondition(saveTotal, rule.save.operator, rule.save.target);
        const damageRoll = this.rollDamage(rule.damage);
        const damagePercent = saveConditionMatched ? rule.save.damagePercentOnMatch : 100;
        const adjustedDamage = Math.max(Math.floor((damageRoll.baseDamage * damagePercent) / 100), 0);

        const nextHp = Math.max(currentHp - adjustedDamage, 0);
        const appliedDamage = Math.max(currentHp - nextHp, 0);

        if (appliedDamage > 0) {
          await this.prisma.sessionCharacterState.updateMany({
            where: {
              sessionCharacterId: sessionCharacter.id,
            },
            data: {
              currentHp: nextHp,
            },
          });
        }

        const nextRounds = rule.roundsLeft - 1;
        if (nextRounds <= 0) {
          await this.prisma.sessionEffect.delete({
            where: {
              id: effect.id,
            },
          });
        } else {
          await this.prisma.sessionEffect.update({
            where: {
              id: effect.id,
            },
            data: {
              duration: this.formatRoundsDuration(nextRounds),
              payload: this.withUpdatedPoisonRounds(effect.payload, nextRounds),
            },
          });
        }

        await this.addSessionEvent(
          sessionId,
          'effect_auto_tick',
          `Авто-тик ${effect.effectType}: ${sessionCharacter.character.name} получает ${appliedDamage} урона (${currentHp} → ${nextHp})`,
          actorTelegramId,
          'COMBAT',
          {
            targetType: 'character',
            targetRefId: sessionCharacter.id,
            effectId: effect.id,
            effectType: effect.effectType,
            appliedDamage,
            damage: {
              ...damageRoll.details,
              baseDamage: damageRoll.baseDamage,
            },
            save: {
              ability: rule.save.ability,
              diceCount: rule.save.diceCount,
              dieSides: rule.save.diceSides,
              operator: rule.save.operator,
              threshold: rule.save.target,
              dc: rule.save.target,
              roll: saveRoll,
              rolls: saveRolls,
              modifier: saveModifier,
              total: saveTotal,
              conditionMatched: saveConditionMatched,
              damagePercent,
            },
            hpBefore: currentHp,
            hpAfter: nextHp,
            roundsLeftAfterTick: Math.max(nextRounds, 0),
          } as Prisma.InputJsonValue
        );

        currentHp = nextHp;
        tickCount += 1;
        totalDamage += appliedDamage;
      }

      return {
        tickCount,
        totalDamage,
      };
    }

    const sessionMonster = await this.prisma.sessionMonster.findFirst({
      where: {
        id: actorId,
        sessionId,
      },
      include: {
        monsterTemplate: {
          select: {
            strength: true,
            dexterity: true,
            constitution: true,
            intelligence: true,
            wisdom: true,
            charisma: true,
          },
        },
        effects: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!sessionMonster) {
      return {
        tickCount: 0,
        totalDamage: 0,
      };
    }

    let currentHp = sessionMonster.currentHp;
    let tickCount = 0;
    let totalDamage = 0;

    for (const effect of sessionMonster.effects) {
      const rule = this.extractPoisonTurnStartRule(effect.effectType, effect.duration, effect.payload);
      if (!rule) {
        continue;
      }

      const saveRolls = Array.from({ length: rule.save.diceCount }).map(() => crypto.randomInt(1, rule.save.diceSides + 1));
      const saveRoll = saveRolls.reduce((acc, value) => acc + value, 0);
      const saveAbilityScore = this.pickMonsterAbilityScore(sessionMonster.monsterTemplate, rule.save.ability);
      const saveModifier = this.abilityScoreToModifier(saveAbilityScore);
      const saveTotal = saveRoll + saveModifier;
      const saveConditionMatched = this.evaluateSaveCondition(saveTotal, rule.save.operator, rule.save.target);
      const damageRoll = this.rollDamage(rule.damage);
      const damagePercent = saveConditionMatched ? rule.save.damagePercentOnMatch : 100;
      const adjustedDamage = Math.max(Math.floor((damageRoll.baseDamage * damagePercent) / 100), 0);

      const nextHp = Math.max(currentHp - adjustedDamage, 0);
      const appliedDamage = Math.max(currentHp - nextHp, 0);

      if (appliedDamage > 0) {
        await this.prisma.sessionMonster.update({
          where: {
            id: sessionMonster.id,
          },
          data: {
            currentHp: nextHp,
          },
        });
      }

      const nextRounds = rule.roundsLeft - 1;
      if (nextRounds <= 0) {
        await this.prisma.sessionMonsterEffect.delete({
          where: {
            id: effect.id,
          },
        });
      } else {
        await this.prisma.sessionMonsterEffect.update({
          where: {
            id: effect.id,
          },
          data: {
            duration: this.formatRoundsDuration(nextRounds),
            payload: this.withUpdatedPoisonRounds(effect.payload, nextRounds),
          },
        });
      }

      await this.addSessionEvent(
        sessionId,
        'monster_effect_auto_tick',
        `Авто-тик ${effect.effectType}: ${sessionMonster.nameSnapshot} получает ${appliedDamage} урона (${currentHp} → ${nextHp})`,
        actorTelegramId,
        'COMBAT',
        {
          targetType: 'monster',
          targetRefId: sessionMonster.id,
          effectId: effect.id,
          effectType: effect.effectType,
          appliedDamage,
          damage: {
            ...damageRoll.details,
            baseDamage: damageRoll.baseDamage,
          },
          save: {
            ability: rule.save.ability,
            diceCount: rule.save.diceCount,
            dieSides: rule.save.diceSides,
            operator: rule.save.operator,
            threshold: rule.save.target,
            dc: rule.save.target,
            roll: saveRoll,
            rolls: saveRolls,
            modifier: saveModifier,
            total: saveTotal,
            conditionMatched: saveConditionMatched,
            damagePercent,
          },
          hpBefore: currentHp,
          hpAfter: nextHp,
          roundsLeftAfterTick: Math.max(nextRounds, 0),
        } as Prisma.InputJsonValue
      );

      currentHp = nextHp;
      tickCount += 1;
      totalDamage += appliedDamage;
    }

    return {
      tickCount,
      totalDamage,
    };
  }

  private async getSessionCharacterOrThrow(sessionId: string, characterId: string) {
    const sessionCharacter = await this.prisma.sessionCharacter.findUnique({
      where: {
        sessionId_characterId: {
          sessionId,
          characterId,
        },
      },
      include: {
        state: true,
        character: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!sessionCharacter) {
      throw new Error('Session character not found');
    }

    return sessionCharacter;
  }

  private async getSessionMonsterOrThrow(sessionId: string, sessionMonsterId: string) {
    const sessionMonster = await this.prisma.sessionMonster.findFirst({
      where: {
        id: sessionMonsterId,
        sessionId,
      },
      include: {
        effects: true,
      },
    });

    if (!sessionMonster) {
      throw new Error('Session monster not found');
    }

    return sessionMonster;
  }

  private async resolveEffectInput(
    templateId: string | undefined,
    effectType: string | undefined,
    duration: string | undefined,
    effectPayload: Prisma.InputJsonValue
  ) {
    if (templateId && templateId.trim()) {
      const template = await this.prisma.statusTemplate.findFirst({
        where: {
          id: templateId.trim(),
          isActive: true,
        },
      });

      if (!template) {
        throw new Error('Validation: status template not found');
      }

      const basePayload = template.payload && typeof template.payload === 'object' && !Array.isArray(template.payload)
        ? JSON.parse(JSON.stringify(template.payload)) as Record<string, unknown>
        : {};
      const meta = basePayload.meta && typeof basePayload.meta === 'object' && !Array.isArray(basePayload.meta)
        ? basePayload.meta as Record<string, unknown>
        : {};

      basePayload.meta = {
        ...meta,
        templateSnapshot: {
          id: template.id,
          key: template.key,
          name: template.name,
          effectType: template.effectType,
          defaultDuration: template.defaultDuration,
          payload: template.payload,
          capturedAt: new Date().toISOString(),
        },
      };

      return {
        effectType: template.effectType,
        duration: duration && duration.trim() ? duration : template.defaultDuration,
        payload: basePayload as Prisma.InputJsonValue,
      };
    }

    if (!effectType || !duration) {
      throw new Error('Validation: effectType and duration are required');
    }

    return {
      effectType,
      duration,
      payload: effectPayload,
    };
  }

  private normalizeJoinCode(joinCode: string): string {
    return joinCode.trim().toUpperCase();
  }

  private generateJoinCode(): string {
    return crypto.randomBytes(3).toString('hex').toUpperCase();
  }

  private async ensureUniqueJoinCode(): Promise<string> {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const joinCode = this.generateJoinCode();
      const exists = await this.prisma.session.findUnique({
        where: { joinCode },
        select: { id: true },
      });

      if (!exists) {
        return joinCode;
      }
    }

    throw new Error('Unable to generate unique join code');
  }

  async isSessionGM(sessionId: string, appUserId: string): Promise<boolean> {
    const membership = await this.prisma.sessionPlayer.findUnique({
      where: {
        sessionId_userId: {
          sessionId,
          userId: appUserId,
        },
      },
      select: { role: true },
    });

    return membership?.role === 'GM';
  }

  async isCharacterOwner(characterId: string, appUserId: string): Promise<boolean> {
    const character = await this.prisma.character.findUnique({
      where: { id: characterId },
      select: { ownerUserId: true },
    });

    return character?.ownerUserId === appUserId;
  }

  async createSession(name: string, telegramUserId: string) {
    const user = await this.resolveUserByTelegramId(telegramUserId);
    const joinCode = await this.ensureUniqueJoinCode();

    const session = await this.prisma.$transaction(async (tx) => {
      const created = await tx.session.create({
        data: {
          name,
          gmUserId: user.id,
          createdByUserId: user.id,
          joinCode,
        },
      });

      await tx.sessionPlayer.create({
        data: {
          sessionId: created.id,
          userId: user.id,
          role: 'GM',
        },
      });

      return created;
    });

    await this.addSessionEvent(session.id, 'session_created', `Сессия "${session.name}" создана`, telegramUserId);

    return session;
  }

  async listSessions(telegramUserId: string) {
    const user = await this.resolveUserByTelegramId(telegramUserId);

    const memberships = await this.prisma.sessionPlayer.findMany({
      where: { userId: user.id },
      include: {
        session: {
          include: {
            players: {
              where: { role: 'GM' },
              select: { id: true },
              take: 1,
            },
            _count: {
              select: {
                players: true,
                characters: true,
              },
            },
          },
        },
      },
      orderBy: {
        session: {
          updatedAt: 'desc',
        },
      },
    });

    return memberships.map((membership) => ({
      id: membership.session.id,
      name: membership.session.name,
      joinCode: membership.session.joinCode,
      gmUserId: membership.session.gmUserId,
      createdByUserId: membership.session.createdByUserId,
      role: membership.role,
      createdAt: membership.session.createdAt,
      updatedAt: membership.session.updatedAt,
      playersCount: membership.session._count.players,
      charactersCount: membership.session._count.characters,
      hasActiveGm: membership.session.players.length > 0,
    }));
  }

  async joinSession(joinCode: string, telegramUserId: string) {
    const normalizedJoinCode = this.normalizeJoinCode(joinCode);
    const user = await this.resolveUserByTelegramId(telegramUserId);

    const session = await this.prisma.session.findUnique({
      where: { joinCode: normalizedJoinCode },
      select: {
        id: true,
        gmUserId: true,
      },
    });

    if (!session) {
      throw new Error('Session not found for provided join code');
    }

    const role = session.gmUserId === user.id ? 'GM' : 'PLAYER';

    const membership = await this.prisma.sessionPlayer.upsert({
      where: {
        sessionId_userId: {
          sessionId: session.id,
          userId: user.id,
        },
      },
      update: {
        role,
      },
      create: {
        sessionId: session.id,
        userId: user.id,
        role,
      },
    });

    await this.addSessionEvent(session.id, 'player_joined', `Игрок ${telegramUserId} присоединился к сессии`, telegramUserId);

    return {
      sessionId: membership.sessionId,
      userId: membership.userId,
      role: membership.role,
    };
  }

  async leaveSession(sessionId: string, telegramUserId: string) {
    const user = await this.resolveUserByTelegramId(telegramUserId);

    const membership = await this.prisma.sessionPlayer.findUnique({
      where: {
        sessionId_userId: {
          sessionId,
          userId: user.id,
        },
      },
    });

    if (!membership) {
      throw new Error('Session membership not found');
    }

    await this.prisma.sessionPlayer.delete({
      where: {
        sessionId_userId: {
          sessionId,
          userId: user.id,
        },
      },
    });

    await this.addSessionEvent(sessionId, 'player_left', `Игрок ${telegramUserId} покинул сессию`, telegramUserId);

    return { message: 'Left session successfully' };
  }

  async deleteSession(sessionId: string, telegramUserId: string) {
    const user = await this.resolveUserByTelegramId(telegramUserId);

    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      select: { id: true },
    });

    if (!session) {
      throw new Error('Session not found');
    }

    await this.requireSessionGM(sessionId, user.id);

    await this.prisma.session.delete({
      where: { id: sessionId },
    });

    return { message: 'Session deleted successfully' };
  }

  async getSessionById(sessionId: string, telegramUserId: string) {
    const user = await this.resolveUserByTelegramId(telegramUserId);
    await this.requireSessionMember(sessionId, user.id);

    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        players: {
          include: {
            user: {
              select: {
                id: true,
                telegramId: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
        characters: {
          include: {
            character: {
              include: {
                class: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
            state: true,
            effects: {
              orderBy: {
                createdAt: 'desc',
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
        monsters: {
          include: {
            effects: {
              orderBy: {
                createdAt: 'desc',
              },
            },
            monsterTemplate: {
              select: {
                id: true,
                name: true,
                size: true,
                creatureType: true,
                alignment: true,
                armorClass: true,
                maxHp: true,
                hitDice: true,
                speed: true,
                strength: true,
                dexterity: true,
                constitution: true,
                intelligence: true,
                wisdom: true,
                charisma: true,
                initiativeModifier: true,
                challengeRating: true,
                damageImmunities: true,
                conditionImmunities: true,
                senses: true,
                languages: true,
                traits: true,
                actions: true,
                legendaryActions: true,
                iconUrl: true,
                imageUrl: true,
                source: true,
                scope: true,
                ownerUserId: true,
                createdAt: true,
                updatedAt: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!session) {
      throw new Error('Session not found');
    }

    return {
      id: session.id,
      name: session.name,
      gmUserId: session.gmUserId,
      createdByUserId: session.createdByUserId,
      joinCode: session.joinCode,
      initiativeLocked: session.initiativeLocked,
      encounterActive: session.encounterActive,
      combatRound: session.combatRound,
      activeTurnSessionCharacterId: session.activeTurnSessionCharacterId,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      hasActiveGm: session.players.some((player) => player.role === 'GM'),
      events: await this.getSessionEvents(session.id),
      players: session.players.map((player) => ({
        id: player.id,
        role: player.role,
        user: player.user,
      })),
      characters: session.characters.map((sessionCharacter) => ({
        id: sessionCharacter.id,
        character: {
          id: sessionCharacter.character.id,
          name: sessionCharacter.character.name,
          level: sessionCharacter.character.level,
          class: sessionCharacter.character.class,
        },
        state: sessionCharacter.state,
        effects: sessionCharacter.effects,
      })),
      monsters: session.monsters.map((monster) => ({
        id: monster.id,
        monsterTemplateId: monster.monsterTemplateId,
        nameSnapshot: monster.nameSnapshot,
        currentHp: monster.currentHp,
        maxHpSnapshot: monster.maxHpSnapshot,
        initiative: monster.initiative,
        notes: monster.notes,
        createdAt: monster.createdAt,
        updatedAt: monster.updatedAt,
        effects: monster.effects,
        effectsCount: monster.effects.length,
        template: monster.monsterTemplate,
      })),
    };
  }

  async attachCharacterToSession(
    sessionId: string,
    characterId: string,
    telegramUserId: string,
    stateInput?: { currentHp?: number; maxHpSnapshot?: number; tempHp?: number | null }
  ) {
    const user = await this.resolveUserByTelegramId(telegramUserId);
    const membership = await this.requireSessionMember(sessionId, user.id);

    const character = await this.prisma.character.findUnique({
      where: { id: characterId },
      select: {
        id: true,
        name: true,
        ownerUserId: true,
      },
    });

    if (!character) {
      throw new Error('Character not found');
    }

    if (character.ownerUserId && character.ownerUserId !== user.id) {
      throw new Error('Forbidden: can attach only your own character');
    }

    if (!character.ownerUserId) {
      await this.prisma.character.update({
        where: { id: characterId },
        data: { ownerUserId: user.id },
      });
    }

    if (membership.role !== 'GM') {
      const ownedAttachedCount = await this.prisma.sessionCharacter.count({
        where: {
          sessionId,
          character: {
            ownerUserId: user.id,
          },
        },
      });

      if (ownedAttachedCount >= 1) {
        throw new Error('Forbidden: player can attach only one character to session');
      }
    }

    const currentHp = stateInput?.currentHp ?? 1;
    this.validateCurrentHp(currentHp);
    this.validateTempHp(stateInput?.tempHp);

    const maxHpSnapshot = stateInput?.maxHpSnapshot ?? currentHp;
    if (!Number.isInteger(maxHpSnapshot) || maxHpSnapshot < 1) {
      throw new Error('Validation: maxHpSnapshot must be a positive integer');
    }

    const sessionCharacter = await this.prisma.sessionCharacter.upsert({
      where: {
        sessionId_characterId: {
          sessionId,
          characterId,
        },
      },
      update: {},
      create: {
        sessionId,
        characterId,
      },
    });

    const state = await this.prisma.sessionCharacterState.upsert({
      where: {
        sessionCharacterId: sessionCharacter.id,
      },
      update: {
        tempHp: stateInput?.tempHp ?? null,
      },
      create: {
        sessionCharacterId: sessionCharacter.id,
        currentHp,
        maxHpSnapshot,
        tempHp: stateInput?.tempHp ?? null,
      },
    });

    await this.addSessionEvent(sessionId, 'character_attached', `${character.name} добавлен в сессию`, telegramUserId);

    return {
      sessionCharacterId: sessionCharacter.id,
      sessionId: sessionCharacter.sessionId,
      characterId: sessionCharacter.characterId,
      state,
    };
  }

  async removeCharacterFromSession(sessionId: string, characterId: string, telegramUserId: string) {
    const user = await this.resolveUserByTelegramId(telegramUserId);
    const membership = await this.requireSessionMember(sessionId, user.id);

    const sessionCharacter = await this.prisma.sessionCharacter.findUnique({
      where: {
        sessionId_characterId: {
          sessionId,
          characterId,
        },
      },
      include: {
        character: {
          select: {
            ownerUserId: true,
            name: true,
          },
        },
      },
    });

    if (!sessionCharacter) {
      throw new Error('Session character not found');
    }

    const isOwner = sessionCharacter.character.ownerUserId === user.id;
    const isGM = membership.role === 'GM';

    if (!isOwner && !isGM) {
      throw new Error('Forbidden: only owner or GM can remove character');
    }

    await this.prisma.sessionCharacter.delete({
      where: {
        sessionId_characterId: {
          sessionId,
          characterId,
        },
      },
    });

    await this.syncEncounterTurnPointer(sessionId);

    if (isOwner) {
      const message = `${sessionCharacter.character.name} покинул сессию`;
      await this.addSessionEvent(sessionId, 'character_left', message, telegramUserId);
      return { message, characterName: sessionCharacter.character.name };
    }

    const message = `ГМ исключил ${sessionCharacter.character.name}`;
    await this.addSessionEvent(sessionId, 'character_removed_by_gm', message, telegramUserId);
    return { message, characterName: sessionCharacter.character.name };
  }

  async getSessionSummary(sessionId: string, telegramUserId: string) {
    const user = await this.resolveUserByTelegramId(telegramUserId);
    await this.requireSessionMember(sessionId, user.id);

    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        name: true,
        joinCode: true,
        initiativeLocked: true,
        encounterActive: true,
        combatRound: true,
        activeTurnSessionCharacterId: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            players: true,
          },
        },
        players: {
          where: {
            role: 'GM',
          },
          select: {
            id: true,
          },
          take: 1,
        },
        characters: {
          select: {
            id: true,
            character: {
              select: {
                id: true,
                name: true,
                level: true,
                class: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
            state: {
              select: {
                id: true,
                sessionCharacterId: true,
                currentHp: true,
                maxHpSnapshot: true,
                tempHp: true,
                initiative: true,
                notes: true,
                createdAt: true,
                updatedAt: true,
              },
            },
            effects: {
              select: {
                id: true,
                sessionCharacterId: true,
                effectType: true,
                duration: true,
                payload: true,
                createdAt: true,
                updatedAt: true,
              },
              orderBy: {
                createdAt: 'desc',
              },
            },
            _count: {
              select: {
                effects: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
        monsters: {
          select: {
            id: true,
            monsterTemplateId: true,
            nameSnapshot: true,
            currentHp: true,
            maxHpSnapshot: true,
            initiative: true,
            notes: true,
            createdAt: true,
            updatedAt: true,
            effects: {
              select: {
                id: true,
                sessionMonsterId: true,
                effectType: true,
                duration: true,
                payload: true,
                createdAt: true,
                updatedAt: true,
              },
              orderBy: {
                createdAt: 'desc',
              },
            },
            _count: {
              select: {
                effects: true,
              },
            },
            monsterTemplate: {
              select: {
                id: true,
                name: true,
                size: true,
                creatureType: true,
                alignment: true,
                armorClass: true,
                maxHp: true,
                hitDice: true,
                speed: true,
                strength: true,
                dexterity: true,
                constitution: true,
                intelligence: true,
                wisdom: true,
                charisma: true,
                initiativeModifier: true,
                challengeRating: true,
                damageImmunities: true,
                conditionImmunities: true,
                senses: true,
                languages: true,
                traits: true,
                actions: true,
                legendaryActions: true,
                iconUrl: true,
                imageUrl: true,
                source: true,
                scope: true,
                ownerUserId: true,
                createdAt: true,
                updatedAt: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!session) {
      throw new Error('Session not found');
    }

    return {
      id: session.id,
      name: session.name,
      joinCode: session.joinCode,
      initiativeLocked: session.initiativeLocked,
      encounterActive: session.encounterActive,
      combatRound: session.combatRound,
      activeTurnSessionCharacterId: session.activeTurnSessionCharacterId,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      playersCount: session._count.players,
      hasActiveGm: session.players.length > 0,
      events: await this.getSessionEvents(session.id),
      characters: session.characters.map((entry) => ({
        id: entry.id,
        character: entry.character,
        state: entry.state,
        effects: entry.effects,
        effectsCount: entry._count.effects,
      })),
      monsters: session.monsters.map((monster) => ({
        id: monster.id,
        monsterTemplateId: monster.monsterTemplateId,
        nameSnapshot: monster.nameSnapshot,
        currentHp: monster.currentHp,
        maxHpSnapshot: monster.maxHpSnapshot,
        initiative: monster.initiative,
        notes: monster.notes,
        createdAt: monster.createdAt,
        updatedAt: monster.updatedAt,
        effects: monster.effects,
        effectsCount: monster._count.effects,
        template: monster.monsterTemplate,
      })),
    };
  }

  async getSessionEventsFeed(sessionId: string, telegramUserId: string, limit = 30, afterEventSeq?: string) {
    const user = await this.resolveUserByTelegramId(telegramUserId);
    await this.requireSessionMember(sessionId, user.id);

    const safeLimit = Number.isInteger(limit) ? Math.min(Math.max(limit, 1), 100) : 30;
    let parsedAfter: bigint | undefined;
    if (afterEventSeq !== undefined) {
      if (!/^\d+$/.test(afterEventSeq.trim())) {
        throw new Error('Validation: after must be a positive integer event sequence');
      }

      parsedAfter = BigInt(afterEventSeq);
    }

    return this.getSessionEvents(sessionId, safeLimit, parsedAfter);
  }

  async getStatusTemplates(sessionId: string, telegramUserId: string) {
    const user = await this.resolveUserByTelegramId(telegramUserId);
    await this.requireSessionMember(sessionId, user.id);

    const templates = await this.prisma.statusTemplate.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    return templates.map((template) => ({
      id: template.id,
      key: template.key,
      name: template.name,
      effectType: template.effectType,
      defaultDuration: template.defaultDuration,
      payload: template.payload,
      isActive: template.isActive,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    }));
  }

  async getCombatSummary(sessionId: string, telegramUserId: string) {
    const user = await this.resolveUserByTelegramId(telegramUserId);
    await this.requireSessionMember(sessionId, user.id);

    let snapshot = await this.prisma.sessionCombatSnapshot.findUnique({
      where: {
        sessionId,
      },
    });

    if (!snapshot) {
      await this.refreshCombatSnapshot(sessionId);
      snapshot = await this.prisma.sessionCombatSnapshot.findUnique({
        where: {
          sessionId,
        },
      });
    }

    const lastEventSeq = await this.getLatestEventSeq(sessionId);
    const pendingReactions = await this.prisma.sessionReactionWindow.findMany({
      where: {
        sessionId,
        status: 'PENDING',
      },
      orderBy: {
        deadlineAt: 'asc',
      },
      take: 50,
    });

    return {
      sessionId,
      encounterActive: snapshot?.encounterActive ?? false,
      combatRound: snapshot?.combatRound ?? 1,
      activeTurnSessionCharacterId: snapshot?.activeTurnSessionCharacterId ?? null,
      initiativeOrder: snapshot?.initiativeOrder ?? [],
      actors: snapshot?.actors ?? [],
      snapshotUpdatedAt: snapshot?.updatedAt ?? null,
      lastEventSeq: lastEventSeq ? lastEventSeq.toString() : null,
      pendingReactions: pendingReactions.map((window) => ({
        id: window.id,
        targetType: window.targetType,
        targetRefId: window.targetRefId,
        reactionType: window.reactionType,
        status: window.status,
        deadlineAt: window.deadlineAt,
      })),
    };
  }

  async getCombatCapabilities(sessionId: string, telegramUserId: string) {
    const user = await this.resolveUserByTelegramId(telegramUserId);
    await this.requireSessionMember(sessionId, user.id);

    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        encounterActive: true,
        activeTurnSessionCharacterId: true,
        characters: {
          select: {
            id: true,
            characterId: true,
            character: {
              select: {
                name: true,
                owner: {
                  select: {
                    telegramId: true,
                  },
                },
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!session) {
      throw new Error('Session not found');
    }

    const actors = await Promise.all(
      session.characters.map(async (entry) => {
        const ownerTelegramId = entry.character.owner?.telegramId;
        if (!ownerTelegramId) {
          return {
            sessionCharacterId: entry.id,
            characterId: entry.characterId,
            characterName: entry.character.name,
            actions: [],
            metadata: null,
            unavailableReason: 'missing_owner_telegram_id',
          };
        }

        try {
          const capabilities = await this.capabilityResolverService.resolveCharacterCapabilities(
            entry.characterId,
            ownerTelegramId,
            { dirtyNodeIds: ['combat:actions'] }
          );

          const actions = capabilities.actions
            .filter((capability) => capability.scope === 'combat' || capability.scope === 'universal')
            .map((capability) => SessionService.mapCombatCapabilityAction(capability));

          return {
            sessionCharacterId: entry.id,
            characterId: entry.characterId,
            characterName: entry.character.name,
            actions,
            metadata: capabilities.metadata,
            unavailableReason: null,
          };
        } catch (error) {
          return {
            sessionCharacterId: entry.id,
            characterId: entry.characterId,
            characterName: entry.character.name,
            actions: [],
            metadata: null,
            unavailableReason: error instanceof Error ? error.message : 'resolver_error',
          };
        }
      })
    );

    return {
      sessionId: session.id,
      encounterActive: session.encounterActive,
      activeTurnSessionCharacterId: session.activeTurnSessionCharacterId,
      actors,
    };
  }

  async getSessionMonsters(sessionId: string, telegramUserId: string) {
    const user = await this.resolveUserByTelegramId(telegramUserId);
    await this.requireSessionMember(sessionId, user.id);

    const monsters = await this.prisma.sessionMonster.findMany({
      where: { sessionId },
      include: {
        monsterTemplate: {
          select: {
            id: true,
            name: true,
            size: true,
            creatureType: true,
            alignment: true,
            armorClass: true,
            maxHp: true,
            hitDice: true,
            speed: true,
            strength: true,
            dexterity: true,
            constitution: true,
            intelligence: true,
            wisdom: true,
            charisma: true,
            initiativeModifier: true,
            challengeRating: true,
            damageImmunities: true,
            conditionImmunities: true,
            senses: true,
            languages: true,
            traits: true,
            actions: true,
            legendaryActions: true,
            iconUrl: true,
            imageUrl: true,
            source: true,
            scope: true,
            ownerUserId: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return monsters;
  }

  async addMonstersFromTemplate(
    sessionId: string,
    telegramUserId: string,
    input: {
      monsterTemplateId: string;
      quantity: number;
    }
  ) {
    const user = await this.resolveUserByTelegramId(telegramUserId);
    await this.requireSessionGM(sessionId, user.id);

    if (!input.monsterTemplateId || typeof input.monsterTemplateId !== 'string') {
      throw new Error('Validation: monsterTemplateId is required');
    }

    if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > 30) {
      throw new Error('Validation: quantity must be an integer in range 1..30');
    }

    const template = await this.prisma.monsterTemplate.findUnique({
      where: { id: input.monsterTemplateId },
      select: {
        id: true,
        name: true,
        maxHp: true,
        scope: true,
        ownerUserId: true,
      },
    });

    if (!template) {
      throw new Error('Monster template not found');
    }

    const canUseTemplate = template.scope === 'GLOBAL' || (template.scope === 'PERSONAL' && template.ownerUserId === user.id);
    if (!canUseTemplate) {
      throw new Error('Forbidden: monster template is not available for current user');
    }

    const currentCount = await this.prisma.sessionMonster.count({
      where: {
        sessionId,
        nameSnapshot: {
          startsWith: `${template.name} #`,
        },
      },
    });

    const now = new Date();
    const toCreate = Array.from({ length: input.quantity }).map((_, index) => {
      const serial = currentCount + index + 1;
      return {
        sessionId,
        monsterTemplateId: template.id,
        nameSnapshot: `${template.name} #${serial}`,
        currentHp: template.maxHp,
        maxHpSnapshot: template.maxHp,
        createdAt: now,
        updatedAt: now,
      };
    });

    await this.prisma.sessionMonster.createMany({
      data: toCreate,
    });

    await this.addSessionEvent(
      sessionId,
      'monsters_added',
      `ГМ добавил ${input.quantity} монстр(ов) типа ${template.name}`,
      telegramUserId
    );

    return {
      addedCount: input.quantity,
      templateName: template.name,
    };
  }

  async removeSessionMonster(sessionId: string, sessionMonsterId: string, telegramUserId: string) {
    const user = await this.resolveUserByTelegramId(telegramUserId);
    await this.requireSessionGM(sessionId, user.id);

    const monster = await this.prisma.sessionMonster.findFirst({
      where: {
        id: sessionMonsterId,
        sessionId,
      },
      select: {
        id: true,
        nameSnapshot: true,
      },
    });

    if (!monster) {
      throw new Error('Session monster not found');
    }

    await this.prisma.sessionMonster.delete({
      where: {
        id: monster.id,
      },
    });

    await this.addSessionEvent(sessionId, 'monster_removed', `ГМ удалил монстра ${monster.nameSnapshot}`, telegramUserId);

    return {
      message: 'Монстр удалён из сессии',
      monsterId: monster.id,
    };
  }

  async setSessionMonsterHp(
    sessionId: string,
    sessionMonsterId: string,
    telegramUserId: string,
    currentHp: number
  ) {
    const user = await this.resolveUserByTelegramId(telegramUserId);
    await this.requireSessionGM(sessionId, user.id);

    this.validateCurrentHp(currentHp);

    const monster = await this.prisma.sessionMonster.findFirst({
      where: {
        id: sessionMonsterId,
        sessionId,
      },
      select: {
        id: true,
        nameSnapshot: true,
        currentHp: true,
      },
    });

    if (!monster) {
      throw new Error('Session monster not found');
    }

    await this.pushUndoSnapshot(sessionId, telegramUserId, {
      kind: 'monster_hp',
      sessionMonsterId: monster.id,
      monsterName: monster.nameSnapshot,
      previousCurrentHp: monster.currentHp,
    });

    const updatedMonster = await this.prisma.sessionMonster.update({
      where: {
        id: monster.id,
      },
      data: {
        currentHp,
      },
    });

    await this.addSessionEvent(
      sessionId,
      'monster_hp_updated',
      `HP монстра ${monster.nameSnapshot} изменён на ${currentHp}`,
      telegramUserId
    );

    return updatedMonster;
  }

  async rollInitiativeForAll(sessionId: string, telegramUserId: string) {
    const user = await this.resolveUserByTelegramId(telegramUserId);
    await this.requireSessionGM(sessionId, user.id);
    await this.ensureInitiativeUnlocked(sessionId);

    const sessionCharacters = await this.prisma.sessionCharacter.findMany({
      where: { sessionId },
      include: {
        character: {
          select: {
            id: true,
            name: true,
            abilityScores: {
              select: {
                dex: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    const characterUpdates = await Promise.all(
      sessionCharacters.map(async (sessionCharacter) => {
        const roll = this.rollD20();
        const dexModifier = this.dexScoreToModifier(sessionCharacter.character.abilityScores?.dex);
        const initiative = roll + dexModifier;
        this.validateInitiative(initiative);

        await this.prisma.sessionCharacterState.upsert({
          where: {
            sessionCharacterId: sessionCharacter.id,
          },
          update: {
            initiative,
          },
          create: {
            sessionCharacterId: sessionCharacter.id,
            currentHp: 1,
            maxHpSnapshot: 1,
            initiative,
          },
        });

        return {
          sessionCharacterId: sessionCharacter.id,
          characterId: sessionCharacter.character.id,
          characterName: sessionCharacter.character.name,
          roll,
          dexModifier,
          initiative,
        };
      })
    );

    const sessionMonsters = await this.prisma.sessionMonster.findMany({
      where: { sessionId },
      include: {
        monsterTemplate: {
          select: {
            initiativeModifier: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    const monsterUpdates = await Promise.all(
      sessionMonsters.map(async (monster) => {
        const roll = this.rollD20();
        const initiativeModifier = monster.monsterTemplate?.initiativeModifier ?? 0;
        const initiative = roll + initiativeModifier;
        this.validateInitiative(initiative);

        await this.prisma.sessionMonster.update({
          where: {
            id: monster.id,
          },
          data: {
            initiative,
          },
        });

        return {
          sessionMonsterId: monster.id,
          roll,
          initiativeModifier,
          initiative,
        };
      })
    );

    await this.addSessionEvent(sessionId, 'initiative_rolled_all', 'ГМ выполнил бросок инициативы для всех участников', telegramUserId);
    await this.syncEncounterTurnPointer(sessionId);

    return {
      updates: characterUpdates,
      monsterUpdates,
      rolledCount: characterUpdates.length + monsterUpdates.length,
    };
  }

  async rollInitiativeForCharacters(sessionId: string, telegramUserId: string) {
    const user = await this.resolveUserByTelegramId(telegramUserId);
    await this.requireSessionGM(sessionId, user.id);
    await this.ensureInitiativeUnlocked(sessionId);

    const sessionCharacters = await this.prisma.sessionCharacter.findMany({
      where: { sessionId },
      include: {
        character: {
          select: {
            id: true,
            name: true,
            abilityScores: {
              select: {
                dex: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    const updates = await Promise.all(
      sessionCharacters.map(async (sessionCharacter) => {
        const roll = this.rollD20();
        const dexModifier = this.dexScoreToModifier(sessionCharacter.character.abilityScores?.dex);
        const initiative = roll + dexModifier;
        this.validateInitiative(initiative);

        await this.prisma.sessionCharacterState.upsert({
          where: {
            sessionCharacterId: sessionCharacter.id,
          },
          update: {
            initiative,
          },
          create: {
            sessionCharacterId: sessionCharacter.id,
            currentHp: 1,
            maxHpSnapshot: 1,
            initiative,
          },
        });

        return {
          sessionCharacterId: sessionCharacter.id,
          characterId: sessionCharacter.character.id,
          characterName: sessionCharacter.character.name,
          roll,
          dexModifier,
          initiative,
        };
      })
    );

    await this.addSessionEvent(sessionId, 'initiative_rolled_characters', 'ГМ выполнил бросок инициативы только для персонажей', telegramUserId);
    await this.syncEncounterTurnPointer(sessionId);

    return {
      updates,
      rolledCount: updates.length,
    };
  }

  async rollInitiativeForMonsters(sessionId: string, telegramUserId: string) {
    const user = await this.resolveUserByTelegramId(telegramUserId);
    await this.requireSessionGM(sessionId, user.id);
    await this.ensureInitiativeUnlocked(sessionId);

    const sessionMonsters = await this.prisma.sessionMonster.findMany({
      where: { sessionId },
      include: {
        monsterTemplate: {
          select: {
            initiativeModifier: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    const updates = await Promise.all(
      sessionMonsters.map(async (monster) => {
        const roll = this.rollD20();
        const initiativeModifier = monster.monsterTemplate?.initiativeModifier ?? 0;
        const initiative = roll + initiativeModifier;
        this.validateInitiative(initiative);

        await this.prisma.sessionMonster.update({
          where: {
            id: monster.id,
          },
          data: {
            initiative,
          },
        });

        return {
          sessionMonsterId: monster.id,
          roll,
          initiativeModifier,
          initiative,
        };
      })
    );

    await this.addSessionEvent(sessionId, 'initiative_rolled_monsters', 'ГМ выполнил бросок инициативы только для монстров', telegramUserId);
    await this.syncEncounterTurnPointer(sessionId);

    return {
      updates,
      rolledCount: updates.length,
    };
  }

  async rollInitiativeForOwnedCharacter(sessionId: string, characterId: string, telegramUserId: string) {
    const user = await this.resolveUserByTelegramId(telegramUserId);
    await this.requireSessionMember(sessionId, user.id);
    await this.ensureInitiativeUnlocked(sessionId);

    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      select: {
        encounterActive: true,
      },
    });

    if (!session) {
      throw new Error('Session not found');
    }

    const sessionCharacter = await this.prisma.sessionCharacter.findUnique({
      where: {
        sessionId_characterId: {
          sessionId,
          characterId,
        },
      },
      include: {
        state: {
          select: {
            initiative: true,
          },
        },
        character: {
          select: {
            id: true,
            name: true,
            ownerUserId: true,
            abilityScores: {
              select: {
                dex: true,
              },
            },
          },
        },
      },
    });

    if (!sessionCharacter) {
      throw new Error('Session character not found');
    }

    if (sessionCharacter.character.ownerUserId !== user.id) {
      throw new Error('Forbidden: can roll initiative only for owned character');
    }

    if (session.encounterActive && sessionCharacter.state?.initiative !== null && sessionCharacter.state?.initiative !== undefined) {
      throw new Error('Validation: self initiative roll is available only once per active encounter');
    }

    const roll = this.rollD20();
    const dexModifier = this.dexScoreToModifier(sessionCharacter.character.abilityScores?.dex);
    const initiative = roll + dexModifier;
    this.validateInitiative(initiative);

    await this.prisma.sessionCharacterState.upsert({
      where: {
        sessionCharacterId: sessionCharacter.id,
      },
      update: {
        initiative,
      },
      create: {
        sessionCharacterId: sessionCharacter.id,
        currentHp: 1,
        maxHpSnapshot: 1,
        initiative,
      },
    });

    await this.addSessionEvent(
      sessionId,
      'initiative_rolled_self',
      `${sessionCharacter.character.name} выполнил бросок инициативы (${roll}${dexModifier >= 0 ? '+' : ''}${dexModifier})`,
      telegramUserId
    );
    await this.syncEncounterTurnPointer(sessionId);

    return {
      sessionCharacterId: sessionCharacter.id,
      characterId: sessionCharacter.character.id,
      characterName: sessionCharacter.character.name,
      roll,
      dexModifier,
      initiative,
    };
  }

  async setSessionCharacterHp(
    sessionId: string,
    characterId: string,
    telegramUserId: string,
    currentHp: number,
    tempHp?: number | null
  ) {
    const user = await this.resolveUserByTelegramId(telegramUserId);
    await this.requireSessionGM(sessionId, user.id);

    this.validateCurrentHp(currentHp);
    this.validateTempHp(tempHp);

    const sessionCharacter = await this.getSessionCharacterOrThrow(sessionId, characterId);

    await this.pushUndoSnapshot(sessionId, telegramUserId, {
      kind: 'character_hp',
      sessionCharacterId: sessionCharacter.id,
      characterName: sessionCharacter.character.name,
      previousState: sessionCharacter.state
        ? {
            currentHp: sessionCharacter.state.currentHp,
            maxHpSnapshot: sessionCharacter.state.maxHpSnapshot,
            tempHp: sessionCharacter.state.tempHp ?? null,
            initiative: sessionCharacter.state.initiative ?? null,
          }
        : null,
    });

    const state = await this.prisma.sessionCharacterState.upsert({
      where: {
        sessionCharacterId: sessionCharacter.id,
      },
      update: {
        currentHp,
        tempHp: tempHp === undefined ? sessionCharacter.state?.tempHp ?? null : tempHp,
      },
      create: {
        sessionCharacterId: sessionCharacter.id,
        currentHp,
        maxHpSnapshot: Math.max(currentHp, 1),
        tempHp: tempHp ?? null,
      },
    });

    await this.addSessionEvent(
      sessionId,
      'hp_updated',
      `HP персонажа ${sessionCharacter.character.name} изменён на ${currentHp}`,
      telegramUserId
    );

    return state;
  }

  async setSessionCharacterInitiative(
    sessionId: string,
    characterId: string,
    telegramUserId: string,
    initiative: number
  ) {
    const user = await this.resolveUserByTelegramId(telegramUserId);
    await this.requireSessionGM(sessionId, user.id);
    await this.ensureInitiativeUnlocked(sessionId);

    this.validateInitiative(initiative);

    const sessionCharacter = await this.getSessionCharacterOrThrow(sessionId, characterId);

    await this.pushUndoSnapshot(sessionId, telegramUserId, {
      kind: 'character_initiative',
      sessionCharacterId: sessionCharacter.id,
      characterName: sessionCharacter.character.name,
      previousState: sessionCharacter.state
        ? {
            currentHp: sessionCharacter.state.currentHp,
            maxHpSnapshot: sessionCharacter.state.maxHpSnapshot,
            tempHp: sessionCharacter.state.tempHp ?? null,
            initiative: sessionCharacter.state.initiative ?? null,
          }
        : null,
    });

    const state = await this.prisma.sessionCharacterState.upsert({
      where: {
        sessionCharacterId: sessionCharacter.id,
      },
      update: {
        initiative,
      },
      create: {
        sessionCharacterId: sessionCharacter.id,
        currentHp: 1,
        maxHpSnapshot: 1,
        initiative,
      },
    });

    await this.addSessionEvent(
      sessionId,
      'initiative_updated',
      `Инициатива персонажа ${sessionCharacter.character.name} изменена на ${initiative}`,
      telegramUserId
    );
    await this.syncEncounterTurnPointer(sessionId);

    return state;
  }

  async lockSessionInitiative(sessionId: string, telegramUserId: string) {
    const user = await this.resolveUserByTelegramId(telegramUserId);
    await this.requireSessionGM(sessionId, user.id);

    await this.prisma.session.update({
      where: { id: sessionId },
      data: { initiativeLocked: true },
    });

    await this.addSessionEvent(sessionId, 'initiative_locked', 'ГМ зафиксировал инициативу (lock)', telegramUserId);

    return { initiativeLocked: true };
  }

  async unlockSessionInitiative(sessionId: string, telegramUserId: string) {
    const user = await this.resolveUserByTelegramId(telegramUserId);
    await this.requireSessionGM(sessionId, user.id);

    await this.prisma.session.update({
      where: { id: sessionId },
      data: { initiativeLocked: false },
    });

    await this.addSessionEvent(sessionId, 'initiative_unlocked', 'ГМ снял lock инициативы', telegramUserId);

    return { initiativeLocked: false };
  }

  async resetSessionInitiative(sessionId: string, telegramUserId: string) {
    const user = await this.resolveUserByTelegramId(telegramUserId);
    await this.requireSessionGM(sessionId, user.id);

    const sessionCharacters = await this.prisma.sessionCharacter.findMany({
      where: { sessionId },
      select: { id: true },
    });

    if (sessionCharacters.length > 0) {
      await this.prisma.sessionCharacterState.updateMany({
        where: {
          sessionCharacterId: {
            in: sessionCharacters.map((entry) => entry.id),
          },
        },
        data: {
          initiative: null,
        },
      });
    }

    await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        initiativeLocked: false,
        encounterActive: false,
        combatRound: 1,
        activeTurnSessionCharacterId: null,
      },
    });

    await this.addSessionEvent(sessionId, 'initiative_reset', 'ГМ сбросил инициативу и снял lock', telegramUserId);

    return { resetCount: sessionCharacters.length, initiativeLocked: false };
  }

  async startEncounter(sessionId: string, telegramUserId: string) {
    const user = await this.resolveUserByTelegramId(telegramUserId);
    await this.requireSessionGM(sessionId, user.id);

    const order = await this.getEncounterOrder(sessionId);
    if (order.length === 0) {
      throw new Error('Validation: cannot start encounter without rolled initiative');
    }

    await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        encounterActive: true,
        combatRound: 1,
        activeTurnSessionCharacterId: order[0],
      },
    });

    await this.addSessionEvent(sessionId, 'encounter_started', 'ГМ начал encounter и открыл первый ход', telegramUserId);

    return {
      encounterActive: true,
      combatRound: 1,
      activeTurnSessionCharacterId: order[0],
    };
  }

  async nextEncounterTurn(sessionId: string, telegramUserId: string) {
    const user = await this.resolveUserByTelegramId(telegramUserId);
    await this.requireSessionGM(sessionId, user.id);

    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      select: {
        encounterActive: true,
        combatRound: true,
        activeTurnSessionCharacterId: true,
      },
    });

    if (!session) {
      throw new Error('Session not found');
    }

    if (!session.encounterActive) {
      throw new Error('Validation: encounter is not active');
    }

    const order = await this.getEncounterOrder(sessionId);
    if (order.length === 0) {
      throw new Error('Validation: no characters with initiative to advance turn');
    }

    const currentIndex = session.activeTurnSessionCharacterId
      ? order.indexOf(session.activeTurnSessionCharacterId)
      : -1;

    let nextIndex = 0;
    let nextRound = Math.max(session.combatRound, 1);

    if (currentIndex >= 0) {
      nextIndex = (currentIndex + 1) % order.length;
      if (nextIndex === 0) {
        nextRound += 1;
      }
    }

    const nextId = order[nextIndex];

    await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        activeTurnSessionCharacterId: nextId,
        combatRound: nextRound,
      },
    });

    await this.addSessionEvent(sessionId, 'turn_advanced', `ГМ передал ход. Раунд ${nextRound}`, telegramUserId);

    const automation = await this.processAutomatedStartOfTurnEffects(sessionId, nextId, telegramUserId);

    return {
      encounterActive: true,
      combatRound: nextRound,
      activeTurnSessionCharacterId: nextId,
      automation,
    };
  }

  async endEncounter(sessionId: string, telegramUserId: string) {
    const user = await this.resolveUserByTelegramId(telegramUserId);
    await this.requireSessionGM(sessionId, user.id);

    await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        encounterActive: false,
        combatRound: 1,
        activeTurnSessionCharacterId: null,
      },
    });

    await this.addSessionEvent(sessionId, 'encounter_ended', 'ГМ завершил encounter', telegramUserId);

    return {
      encounterActive: false,
      combatRound: 1,
      activeTurnSessionCharacterId: null,
    };
  }

  async applySessionCharacterEffect(
    sessionId: string,
    characterId: string,
    telegramUserId: string,
    effectType: string,
    duration: string,
    payload: Prisma.InputJsonValue
  ) {
    const user = await this.resolveUserByTelegramId(telegramUserId);
    await this.requireSessionGM(sessionId, user.id);

    if (!effectType || !effectType.trim()) {
      throw new Error('Validation: effectType is required');
    }

    if (!duration || !duration.trim()) {
      throw new Error('Validation: duration is required');
    }

    const sessionCharacter = await this.getSessionCharacterOrThrow(sessionId, characterId);

    const normalizedPayload = this.normalizePoisonEffectPayload(effectType, duration, payload);

    const effect = await this.prisma.sessionEffect.create({
      data: {
        sessionCharacterId: sessionCharacter.id,
        effectType: effectType.trim(),
        duration: duration.trim(),
        payload: normalizedPayload,
      },
    });

    await this.pushUndoSnapshot(sessionId, telegramUserId, {
      kind: 'effect_applied',
      effectId: effect.id,
      sessionCharacterId: sessionCharacter.id,
      characterName: sessionCharacter.character.name,
      effectType: effect.effectType,
    });

    await this.addSessionEvent(
      sessionId,
      'effect_applied',
      `Эффект ${effect.effectType} применён к ${sessionCharacter.character.name}`,
      telegramUserId,
      'COMBAT'
    );

    return effect;
  }

  async applySessionMonsterEffect(
    sessionId: string,
    sessionMonsterId: string,
    telegramUserId: string,
    effectType: string,
    duration: string,
    payload: Prisma.InputJsonValue
  ) {
    const user = await this.resolveUserByTelegramId(telegramUserId);
    await this.requireSessionGM(sessionId, user.id);

    if (!effectType || !effectType.trim()) {
      throw new Error('Validation: effectType is required');
    }

    if (!duration || !duration.trim()) {
      throw new Error('Validation: duration is required');
    }

    const sessionMonster = await this.getSessionMonsterOrThrow(sessionId, sessionMonsterId);

    const normalizedPayload = this.normalizePoisonEffectPayload(effectType, duration, payload);

    const effect = await this.prisma.sessionMonsterEffect.create({
      data: {
        sessionMonsterId: sessionMonster.id,
        effectType: effectType.trim(),
        duration: duration.trim(),
        payload: normalizedPayload,
      },
    });

    await this.pushUndoSnapshot(sessionId, telegramUserId, {
      kind: 'monster_effect_applied',
      effectId: effect.id,
      sessionMonsterId: sessionMonster.id,
      monsterName: sessionMonster.nameSnapshot,
      effectType: effect.effectType,
    });

    await this.addSessionEvent(
      sessionId,
      'monster_effect_applied',
      `Эффект ${effect.effectType} применён к монстру ${sessionMonster.nameSnapshot}`,
      telegramUserId,
      'COMBAT'
    );

    return effect;
  }

  async removeSessionCharacterEffect(
    sessionId: string,
    characterId: string,
    effectId: string,
    telegramUserId: string
  ) {
    const user = await this.resolveUserByTelegramId(telegramUserId);
    await this.requireSessionGM(sessionId, user.id);

    const sessionCharacter = await this.getSessionCharacterOrThrow(sessionId, characterId);

    const effect = await this.prisma.sessionEffect.findFirst({
      where: {
        id: effectId,
        sessionCharacterId: sessionCharacter.id,
      },
    });

    if (!effect) {
      throw new Error('Session effect not found');
    }

    await this.pushUndoSnapshot(sessionId, telegramUserId, {
      kind: 'effect_removed',
      effectId: effect.id,
      sessionCharacterId: sessionCharacter.id,
      characterName: sessionCharacter.character.name,
      effectType: effect.effectType,
      duration: effect.duration,
      payload: effect.payload,
    });

    await this.prisma.sessionEffect.delete({
      where: {
        id: effect.id,
      },
    });

    await this.addSessionEvent(
      sessionId,
      'effect_removed',
      `Эффект ${effect.effectType} снят с ${sessionCharacter.character.name}`,
      telegramUserId,
      'COMBAT'
    );

    return {
      removedEffectId: effect.id,
      characterId,
      effectType: effect.effectType,
    };
  }

  async removeSessionMonsterEffect(
    sessionId: string,
    sessionMonsterId: string,
    effectId: string,
    telegramUserId: string
  ) {
    const user = await this.resolveUserByTelegramId(telegramUserId);
    await this.requireSessionGM(sessionId, user.id);

    const sessionMonster = await this.getSessionMonsterOrThrow(sessionId, sessionMonsterId);

    const effect = await this.prisma.sessionMonsterEffect.findFirst({
      where: {
        id: effectId,
        sessionMonsterId: sessionMonster.id,
      },
    });

    if (!effect) {
      throw new Error('Session monster effect not found');
    }

    await this.pushUndoSnapshot(sessionId, telegramUserId, {
      kind: 'monster_effect_removed',
      effectId: effect.id,
      sessionMonsterId: sessionMonster.id,
      monsterName: sessionMonster.nameSnapshot,
      effectType: effect.effectType,
      duration: effect.duration,
      payload: effect.payload,
    });

    await this.prisma.sessionMonsterEffect.delete({
      where: {
        id: effect.id,
      },
    });

    await this.addSessionEvent(
      sessionId,
      'monster_effect_removed',
      `Эффект ${effect.effectType} снят с монстра ${sessionMonster.nameSnapshot}`,
      telegramUserId,
      'COMBAT'
    );

    return {
      removedEffectId: effect.id,
      monsterId: sessionMonsterId,
      effectType: effect.effectType,
    };
  }

  async openReactionWindow(
    sessionId: string,
    telegramUserId: string,
    input: {
      targetType: 'character' | 'monster';
      targetRefId: string;
      reactionType: string;
      ttlSeconds?: number;
    }
  ) {
    const user = await this.resolveUserByTelegramId(telegramUserId);
    await this.requireSessionGM(sessionId, user.id);

    const targetType = input.targetType;
    if (targetType !== 'character' && targetType !== 'monster') {
      throw new Error('Validation: targetType must be character or monster');
    }

    if (!input.targetRefId || !input.targetRefId.trim()) {
      throw new Error('Validation: targetRefId is required');
    }

    if (!input.reactionType || !input.reactionType.trim()) {
      throw new Error('Validation: reactionType is required');
    }

    const ttlSeconds = Number.isInteger(input.ttlSeconds) ? Number(input.ttlSeconds) : 15;
    if (ttlSeconds < 3 || ttlSeconds > 120) {
      throw new Error('Validation: ttlSeconds must be in range 3..120');
    }

    const deadlineAt = new Date(Date.now() + ttlSeconds * 1000);
    const window = await this.prisma.sessionReactionWindow.create({
      data: {
        sessionId,
        targetType,
        targetRefId: input.targetRefId,
        reactionType: input.reactionType.trim(),
        deadlineAt,
        requestedByUserId: user.id,
      },
    });

    await this.addSessionEvent(
      sessionId,
      'reaction_available',
      `Доступна реакция ${window.reactionType} для ${targetType}:${window.targetRefId}`,
      telegramUserId,
      'COMBAT',
      {
        reactionId: window.id,
        targetType: window.targetType,
        targetRefId: window.targetRefId,
        reactionType: window.reactionType,
        deadlineAt: window.deadlineAt.toISOString(),
      }
    );

    return window;
  }

  async respondReactionWindow(
    sessionId: string,
    reactionId: string,
    telegramUserId: string,
    responsePayload: Prisma.InputJsonValue
  ) {
    const user = await this.resolveUserByTelegramId(telegramUserId);
    await this.requireSessionMember(sessionId, user.id);

    const window = await this.prisma.sessionReactionWindow.findFirst({
      where: {
        id: reactionId,
        sessionId,
      },
    });

    if (!window) {
      throw new Error('Reaction window not found');
    }

    if (window.status !== 'PENDING') {
      throw new Error('Validation: reaction window is not pending');
    }

    if (window.deadlineAt.getTime() <= Date.now()) {
      await this.prisma.sessionReactionWindow.update({
        where: {
          id: window.id,
        },
        data: {
          status: 'EXPIRED',
          resolvedAt: new Date(),
        },
      });

      throw new Error('Validation: reaction window has expired');
    }

    const updated = await this.prisma.sessionReactionWindow.update({
      where: {
        id: window.id,
      },
      data: {
        status: 'RESOLVED',
        resolvedByUserId: user.id,
        responsePayload,
        resolvedAt: new Date(),
      },
    });

    await this.addSessionEvent(
      sessionId,
      'reaction_resolved',
      `Реакция ${updated.reactionType} обработана`,
      telegramUserId,
      'COMBAT',
      {
        reactionId: updated.id,
        status: updated.status,
      }
    );

    return updated;
  }

  async executeCombatAction(
    sessionId: string,
    telegramUserId: string,
    idempotencyKey: string,
    actionType: CombatActionType,
    payload: CombatActionPayload
  ) {
    const user = await this.resolveUserByTelegramId(telegramUserId);
    await this.requireSessionMember(sessionId, user.id);

    const normalizedKey = String(idempotencyKey || '').trim();
    if (!normalizedKey) {
      throw new Error('Validation: idempotencyKey is required');
    }

    if (normalizedKey.length > 128) {
      throw new Error('Validation: idempotencyKey length must be <= 128');
    }

    const existing = await this.prisma.sessionCombatAction.findUnique({
      where: {
        sessionId_idempotencyKey: {
          sessionId,
          idempotencyKey: normalizedKey,
        },
      },
    });

    if (existing?.status === 'completed' && existing.responsePayload) {
      return {
        ...(existing.responsePayload as Record<string, unknown>),
        idempotentReplay: true,
      };
    }

    if (existing?.status === 'failed') {
      throw new Error('Validation: action with this idempotencyKey already failed');
    }

    const beforeSeq = await this.getLatestEventSeq(sessionId);

    const actionRecord = await this.prisma.sessionCombatAction.create({
      data: {
        sessionId,
        actorUserId: user.id,
        idempotencyKey: normalizedKey,
        actionType,
        status: 'processing',
        requestPayload: payload as Prisma.InputJsonValue,
      },
    });

    try {
      let result: unknown;

      if (actionType === 'START_ENCOUNTER') {
        result = await this.startEncounter(sessionId, telegramUserId);
      } else if (actionType === 'NEXT_TURN') {
        result = await this.nextEncounterTurn(sessionId, telegramUserId);
      } else if (actionType === 'END_ENCOUNTER') {
        result = await this.endEncounter(sessionId, telegramUserId);
      } else if (actionType === 'UNDO_LAST') {
        result = await this.undoLastCombatAction(sessionId, telegramUserId);
      } else if (actionType === 'SET_CHARACTER_HP') {
        if (!payload.characterId || payload.currentHp === undefined) {
          throw new Error('Validation: characterId and currentHp are required');
        }

        result = await this.setSessionCharacterHp(
          sessionId,
          payload.characterId,
          telegramUserId,
          payload.currentHp,
          payload.tempHp
        );
      } else if (actionType === 'SET_MONSTER_HP') {
        if (!payload.monsterId || payload.currentHp === undefined) {
          throw new Error('Validation: monsterId and currentHp are required');
        }

        result = await this.setSessionMonsterHp(sessionId, payload.monsterId, telegramUserId, payload.currentHp);
      } else if (actionType === 'SET_CHARACTER_INITIATIVE') {
        if (!payload.characterId || payload.initiative === undefined) {
          throw new Error('Validation: characterId and initiative are required');
        }

        result = await this.setSessionCharacterInitiative(
          sessionId,
          payload.characterId,
          telegramUserId,
          payload.initiative
        );
      } else if (actionType === 'ROLL_INITIATIVE_CHARACTERS') {
        result = await this.rollInitiativeForCharacters(sessionId, telegramUserId);
      } else if (actionType === 'ROLL_INITIATIVE_MONSTERS') {
        result = await this.rollInitiativeForMonsters(sessionId, telegramUserId);
      } else if (actionType === 'ROLL_INITIATIVE_SELF') {
        if (!payload.characterId) {
          throw new Error('Validation: characterId is required');
        }

        result = await this.rollInitiativeForOwnedCharacter(sessionId, payload.characterId, telegramUserId);
      } else if (actionType === 'LOCK_INITIATIVE') {
        result = await this.lockSessionInitiative(sessionId, telegramUserId);
      } else if (actionType === 'UNLOCK_INITIATIVE') {
        result = await this.unlockSessionInitiative(sessionId, telegramUserId);
      } else if (actionType === 'RESET_INITIATIVE') {
        result = await this.resetSessionInitiative(sessionId, telegramUserId);
      } else if (actionType === 'APPLY_CHARACTER_EFFECT') {
        if (!payload.characterId) {
          throw new Error('Validation: characterId is required');
        }

        const resolvedEffect = await this.resolveEffectInput(
          payload.templateId,
          payload.effectType,
          payload.duration,
          (payload.effectPayload || {}) as Prisma.InputJsonValue
        );

        result = await this.applySessionCharacterEffect(
          sessionId,
          payload.characterId,
          telegramUserId,
          resolvedEffect.effectType,
          resolvedEffect.duration,
          resolvedEffect.payload
        );
      } else if (actionType === 'APPLY_MONSTER_EFFECT') {
        if (!payload.monsterId) {
          throw new Error('Validation: monsterId is required');
        }

        const resolvedEffect = await this.resolveEffectInput(
          payload.templateId,
          payload.effectType,
          payload.duration,
          (payload.effectPayload || {}) as Prisma.InputJsonValue
        );

        result = await this.applySessionMonsterEffect(
          sessionId,
          payload.monsterId,
          telegramUserId,
          resolvedEffect.effectType,
          resolvedEffect.duration,
          resolvedEffect.payload
        );
      } else if (actionType === 'REMOVE_CHARACTER_EFFECT') {
        if (!payload.characterId || !payload.effectId) {
          throw new Error('Validation: characterId and effectId are required');
        }

        result = await this.removeSessionCharacterEffect(
          sessionId,
          payload.characterId,
          payload.effectId,
          telegramUserId
        );
      } else if (actionType === 'REMOVE_MONSTER_EFFECT') {
        if (!payload.monsterId || !payload.effectId) {
          throw new Error('Validation: monsterId and effectId are required');
        }

        result = await this.removeSessionMonsterEffect(
          sessionId,
          payload.monsterId,
          payload.effectId,
          telegramUserId
        );
      } else if (actionType === 'OPEN_REACTION_WINDOW') {
        if (!payload.targetType || !payload.targetRefId || !payload.reactionType) {
          throw new Error('Validation: targetType, targetRefId, reactionType are required');
        }

        result = await this.openReactionWindow(sessionId, telegramUserId, {
          targetType: payload.targetType,
          targetRefId: payload.targetRefId,
          reactionType: payload.reactionType,
          ttlSeconds: payload.ttlSeconds,
        });
      } else if (actionType === 'RESPOND_REACTION_WINDOW') {
        if (!payload.reactionId) {
          throw new Error('Validation: reactionId is required');
        }

        result = await this.respondReactionWindow(
          sessionId,
          payload.reactionId,
          telegramUserId,
          (payload.responsePayload || {}) as Prisma.InputJsonValue
        );
      } else {
        throw new Error('Validation: unsupported combat action type');
      }

      const combatEvents = await this.getSessionEvents(sessionId, 100, beforeSeq ?? undefined);
      const responsePayload = {
        actionType,
        result,
        combatEvents,
      } as Record<string, unknown>;

      await this.prisma.sessionCombatAction.update({
        where: {
          id: actionRecord.id,
        },
        data: {
          status: 'completed',
          responsePayload: responsePayload as Prisma.InputJsonValue,
        },
      });

      return {
        ...responsePayload,
        idempotentReplay: false,
      };
    } catch (error) {
      await this.prisma.sessionCombatAction.update({
        where: {
          id: actionRecord.id,
        },
        data: {
          status: 'failed',
          responsePayload: {
            error: error instanceof Error ? error.message : 'Unknown combat action error',
          } as Prisma.InputJsonValue,
        },
      });

      throw error;
    }
  }

  async undoLastCombatAction(sessionId: string, telegramUserId: string) {
    const user = await this.resolveUserByTelegramId(telegramUserId);
    await this.requireSessionGM(sessionId, user.id);

    const snapshotEvent = await this.prisma.sessionEvent.findFirst({
      where: {
        sessionId,
        type: 'undo_snapshot',
      },
      orderBy: {
        eventSeq: 'desc',
      },
    });

    if (!snapshotEvent) {
      throw new Error('Validation: no combat action available for undo');
    }

    const snapshot = this.parseUndoSnapshot(snapshotEvent.message);

    if (snapshot.kind === 'character_hp' || snapshot.kind === 'character_initiative') {
      if (!snapshot.previousState) {
        await this.prisma.sessionCharacterState.deleteMany({
          where: {
            sessionCharacterId: snapshot.sessionCharacterId,
          },
        });
      } else {
        await this.prisma.sessionCharacterState.updateMany({
          where: {
            sessionCharacterId: snapshot.sessionCharacterId,
          },
          data: {
            currentHp: snapshot.previousState.currentHp,
            maxHpSnapshot: snapshot.previousState.maxHpSnapshot,
            tempHp: snapshot.previousState.tempHp,
            initiative: snapshot.previousState.initiative,
          },
        });
      }
    }

    if (snapshot.kind === 'monster_hp') {
      await this.prisma.sessionMonster.updateMany({
        where: {
          id: snapshot.sessionMonsterId,
          sessionId,
        },
        data: {
          currentHp: snapshot.previousCurrentHp,
        },
      });
    }

    if (snapshot.kind === 'effect_applied') {
      await this.prisma.sessionEffect.deleteMany({
        where: {
          id: snapshot.effectId,
          sessionCharacterId: snapshot.sessionCharacterId,
        },
      });
    }

    if (snapshot.kind === 'monster_effect_applied') {
      await this.prisma.sessionMonsterEffect.deleteMany({
        where: {
          id: snapshot.effectId,
          sessionMonsterId: snapshot.sessionMonsterId,
        },
      });
    }

    if (snapshot.kind === 'effect_removed') {
      await this.prisma.sessionEffect.create({
        data: {
          id: snapshot.effectId,
          sessionCharacterId: snapshot.sessionCharacterId,
          effectType: snapshot.effectType,
          duration: snapshot.duration,
          payload: snapshot.payload as Prisma.InputJsonValue,
        },
      });
    }

    if (snapshot.kind === 'monster_effect_removed') {
      await this.prisma.sessionMonsterEffect.create({
        data: {
          id: snapshot.effectId,
          sessionMonsterId: snapshot.sessionMonsterId,
          effectType: snapshot.effectType,
          duration: snapshot.duration,
          payload: snapshot.payload as Prisma.InputJsonValue,
        },
      });
    }

    await this.prisma.sessionEvent.delete({
      where: {
        id: snapshotEvent.id,
      },
    });

    await this.syncEncounterTurnPointer(sessionId);

    let message = 'Последнее боевое действие отменено';
    if (snapshot.kind === 'character_hp') {
      message = `Отменено изменение HP персонажа ${snapshot.characterName}`;
    }
    if (snapshot.kind === 'character_initiative') {
      message = `Отменено изменение инициативы персонажа ${snapshot.characterName}`;
    }
    if (snapshot.kind === 'monster_hp') {
      message = `Отменено изменение HP монстра ${snapshot.monsterName}`;
    }
    if (snapshot.kind === 'effect_applied') {
      message = `Отменено применение эффекта ${snapshot.effectType} к ${snapshot.characterName}`;
    }
    if (snapshot.kind === 'monster_effect_applied') {
      message = `Отменено применение эффекта ${snapshot.effectType} к монстру ${snapshot.monsterName}`;
    }
    if (snapshot.kind === 'effect_removed') {
      message = `Отменено снятие эффекта ${snapshot.effectType} с ${snapshot.characterName}`;
    }
    if (snapshot.kind === 'monster_effect_removed') {
      message = `Отменено снятие эффекта ${snapshot.effectType} с монстра ${snapshot.monsterName}`;
    }

    await this.addSessionEvent(sessionId, 'combat_action_undone', message, telegramUserId);

    return {
      undoneType: snapshot.kind,
      message,
    };
  }
}

export default SessionService;
