import { PrismaClient, Prisma } from '@prisma/client';
import crypto from 'crypto';

export class SessionService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  private async addSessionEvent(sessionId: string, type: string, message: string, actorTelegramId: string) {
    await this.prisma.sessionEvent.create({
      data: {
        sessionId,
        type,
        message,
        actorTelegramId,
      },
    });
  }

  private async getSessionEvents(sessionId: string, limit = 100) {
    const safeLimit = Number.isInteger(limit) ? Math.min(Math.max(limit, 1), 100) : 100;

    const events = await this.prisma.sessionEvent.findMany({
      where: { sessionId },
      orderBy: {
        createdAt: 'desc',
      },
      take: safeLimit,
    });

    return events.map((event) => ({
      id: event.id,
      type: event.type,
      message: event.message,
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
    const entries = await this.prisma.sessionCharacter.findMany({
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
    });

    return entries
      .filter((entry) => entry.state?.initiative !== null && entry.state?.initiative !== undefined)
      .sort((left, right) => {
        const leftInitiative = left.state?.initiative ?? -999;
        const rightInitiative = right.state?.initiative ?? -999;

        if (rightInitiative !== leftInitiative) {
          return rightInitiative - leftInitiative;
        }

        return left.character.name.localeCompare(right.character.name);
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

  private rollD20(): number {
    return crypto.randomInt(1, 21);
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
        effectsCount: entry._count.effects,
      })),
      monsters: session.monsters,
    };
  }

  async getSessionEventsFeed(sessionId: string, telegramUserId: string, limit = 30) {
    const user = await this.resolveUserByTelegramId(telegramUserId);
    await this.requireSessionMember(sessionId, user.id);

    const safeLimit = Number.isInteger(limit) ? Math.min(Math.max(limit, 1), 100) : 30;
    return this.getSessionEvents(sessionId, safeLimit);
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

    await this.addSessionEvent(sessionId, 'initiative_rolled_all', 'ГМ выполнил бросок инициативы для всей группы', telegramUserId);
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

    return {
      encounterActive: true,
      combatRound: nextRound,
      activeTurnSessionCharacterId: nextId,
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

    const effect = await this.prisma.sessionEffect.create({
      data: {
        sessionCharacterId: sessionCharacter.id,
        effectType: effectType.trim(),
        duration: duration.trim(),
        payload,
      },
    });

    await this.addSessionEvent(
      sessionId,
      'effect_applied',
      `Эффект ${effect.effectType} применён к ${sessionCharacter.character.name}`,
      telegramUserId
    );

    return effect;
  }
}

export default SessionService;
