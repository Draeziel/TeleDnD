import { PrismaClient, Prisma } from '@prisma/client';
import crypto from 'crypto';

interface SessionEventEntry {
  id: string;
  type: string;
  message: string;
  actorTelegramId: string;
  createdAt: Date;
}

export class SessionService {
  private prisma: PrismaClient;
  private sessionEvents = new Map<string, SessionEventEntry[]>();

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  private addSessionEvent(sessionId: string, type: string, message: string, actorTelegramId: string) {
    const current = this.sessionEvents.get(sessionId) ?? [];

    current.unshift({
      id: crypto.randomUUID(),
      type,
      message,
      actorTelegramId,
      createdAt: new Date(),
    });

    this.sessionEvents.set(sessionId, current.slice(0, 100));
  }

  private getSessionEvents(sessionId: string) {
    return (this.sessionEvents.get(sessionId) ?? []).map((event) => ({
      id: event.id,
      type: event.type,
      message: event.message,
      actorTelegramId: event.actorTelegramId,
      createdAt: event.createdAt,
    }));
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

    this.addSessionEvent(session.id, 'session_created', `Сессия "${session.name}" создана`, telegramUserId);

    return session;
  }

  async listSessions(telegramUserId: string) {
    const user = await this.resolveUserByTelegramId(telegramUserId);

    const memberships = await this.prisma.sessionPlayer.findMany({
      where: { userId: user.id },
      include: {
        session: {
          include: {
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

    this.addSessionEvent(session.id, 'player_joined', `Игрок ${telegramUserId} присоединился к сессии`, telegramUserId);

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

    this.addSessionEvent(sessionId, 'player_left', `Игрок ${telegramUserId} покинул сессию`, telegramUserId);

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
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      hasActiveGm: session.players.some((player) => player.role === 'GM'),
      events: this.getSessionEvents(session.id),
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
    };
  }

  async attachCharacterToSession(
    sessionId: string,
    characterId: string,
    telegramUserId: string,
    stateInput?: { currentHp?: number; maxHpSnapshot?: number; tempHp?: number | null }
  ) {
    const user = await this.resolveUserByTelegramId(telegramUserId);
    await this.requireSessionMember(sessionId, user.id);

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

    this.addSessionEvent(sessionId, 'character_attached', `${character.name} добавлен в сессию`, telegramUserId);

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

    if (isOwner) {
      const message = `${sessionCharacter.character.name} покинул сессию`;
      this.addSessionEvent(sessionId, 'character_left', message, telegramUserId);
      return { message, characterName: sessionCharacter.character.name };
    }

    const message = `ГМ исключил ${sessionCharacter.character.name}`;
    this.addSessionEvent(sessionId, 'character_removed_by_gm', message, telegramUserId);
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
      },
    });

    if (!session) {
      throw new Error('Session not found');
    }

    return {
      id: session.id,
      name: session.name,
      joinCode: session.joinCode,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      playersCount: session._count.players,
      hasActiveGm: session.players.length > 0,
      events: this.getSessionEvents(session.id),
      characters: session.characters.map((entry) => ({
        id: entry.id,
        character: entry.character,
        state: entry.state,
        effectsCount: entry._count.effects,
      })),
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

    this.addSessionEvent(
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

    this.addSessionEvent(
      sessionId,
      'initiative_updated',
      `Инициатива персонажа ${sessionCharacter.character.name} изменена на ${initiative}`,
      telegramUserId
    );

    return state;
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

    this.addSessionEvent(
      sessionId,
      'effect_applied',
      `Эффект ${effect.effectType} применён к ${sessionCharacter.character.name}`,
      telegramUserId
    );

    return effect;
  }
}

export default SessionService;
