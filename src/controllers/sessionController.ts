import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { SessionService } from '../services/sessionService';

function getTelegramUserId(res: Response): string | null {
  const telegramUserId = res.locals.telegramUserId;
  if (!telegramUserId) {
    return null;
  }

  return String(telegramUserId);
}

export class SessionController {
  private sessionService: SessionService;

  constructor(prisma: PrismaClient) {
    this.sessionService = new SessionService(prisma);
  }

  public async createSession(req: Request, res: Response): Promise<void> {
    try {
      const telegramUserId = getTelegramUserId(res);
      if (!telegramUserId) {
        res.status(401).json({ message: 'Unauthorized: Telegram user context is missing' });
        return;
      }

      const { name } = req.body;
      if (!name || typeof name !== 'string') {
        res.status(400).json({ message: 'name is required' });
        return;
      }

      const trimmedName = name.trim();
      if (trimmedName.length < 2) {
        res.status(400).json({ message: 'name length must be at least 2 characters' });
        return;
      }

      const session = await this.sessionService.createSession(trimmedName, telegramUserId);
      res.status(201).json(session);
    } catch (error) {
      res.status(500).json({ message: 'Error creating session', error });
    }
  }

  public async listSessions(req: Request, res: Response): Promise<void> {
    try {
      const telegramUserId = getTelegramUserId(res);
      if (!telegramUserId) {
        res.status(401).json({ message: 'Unauthorized: Telegram user context is missing' });
        return;
      }

      const sessions = await this.sessionService.listSessions(telegramUserId);
      res.status(200).json(sessions);
    } catch (error) {
      res.status(500).json({ message: 'Error retrieving sessions', error });
    }
  }

  public async joinSession(req: Request, res: Response): Promise<void> {
    try {
      const telegramUserId = getTelegramUserId(res);
      if (!telegramUserId) {
        res.status(401).json({ message: 'Unauthorized: Telegram user context is missing' });
        return;
      }

      const { joinCode } = req.body;
      if (!joinCode || typeof joinCode !== 'string') {
        res.status(400).json({ message: 'joinCode is required' });
        return;
      }

      const membership = await this.sessionService.joinSession(joinCode, telegramUserId);
      res.status(200).json(membership);
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'Error joining session', error });
      }
    }
  }

  public async leaveSession(req: Request, res: Response): Promise<void> {
    try {
      const telegramUserId = getTelegramUserId(res);
      if (!telegramUserId) {
        res.status(401).json({ message: 'Unauthorized: Telegram user context is missing' });
        return;
      }

      const { id } = req.params;
      const result = await this.sessionService.leaveSession(id, telegramUserId);
      res.status(200).json(result);
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ message: error.message });
      } else if (error instanceof Error && error.message.includes('cannot leave')) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'Error leaving session', error });
      }
    }
  }

  public async deleteSession(req: Request, res: Response): Promise<void> {
    try {
      const telegramUserId = getTelegramUserId(res);
      if (!telegramUserId) {
        res.status(401).json({ message: 'Unauthorized: Telegram user context is missing' });
        return;
      }

      const { id } = req.params;
      const result = await this.sessionService.deleteSession(id, telegramUserId);
      res.status(200).json(result);
    } catch (error) {
      if (error instanceof Error && error.message.includes('Forbidden')) {
        res.status(403).json({ message: error.message });
      } else if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'Error deleting session', error });
      }
    }
  }

  public async getSession(req: Request, res: Response): Promise<void> {
    try {
      const telegramUserId = getTelegramUserId(res);
      if (!telegramUserId) {
        res.status(401).json({ message: 'Unauthorized: Telegram user context is missing' });
        return;
      }

      const { id } = req.params;
      const session = await this.sessionService.getSessionById(id, telegramUserId);
      res.status(200).json(session);
    } catch (error) {
      if (error instanceof Error && error.message.includes('Forbidden')) {
        res.status(403).json({ message: error.message });
      } else if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'Error retrieving session', error });
      }
    }
  }

  public async getSessionSummary(req: Request, res: Response): Promise<void> {
    try {
      const telegramUserId = getTelegramUserId(res);
      if (!telegramUserId) {
        res.status(401).json({ message: 'Unauthorized: Telegram user context is missing' });
        return;
      }

      const { id } = req.params;
      const summary = await this.sessionService.getSessionSummary(id, telegramUserId);
      res.status(200).json(summary);
    } catch (error) {
      if (error instanceof Error && error.message.includes('Forbidden')) {
        res.status(403).json({ message: error.message });
      } else if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'Error retrieving session summary', error });
      }
    }
  }

  public async getSessionEvents(req: Request, res: Response): Promise<void> {
    try {
      const telegramUserId = getTelegramUserId(res);
      if (!telegramUserId) {
        res.status(401).json({ message: 'Unauthorized: Telegram user context is missing' });
        return;
      }

      const { id } = req.params;
      const rawLimit = req.query.limit;
      const rawAfter = req.query.after;
      const parsedLimit = typeof rawLimit === 'string' ? Number(rawLimit) : undefined;
      const parsedAfter = typeof rawAfter === 'string' ? rawAfter : undefined;
      const events = await this.sessionService.getSessionEventsFeed(id, telegramUserId, parsedLimit, parsedAfter);
      res.status(200).json(events);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Validation:')) {
        res.status(400).json({ message: error.message });
      } else if (error instanceof Error && error.message.includes('Forbidden')) {
        res.status(403).json({ message: error.message });
      } else if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'Error retrieving session events', error });
      }
    }
  }

  public async getCombatSummary(req: Request, res: Response): Promise<void> {
    try {
      const telegramUserId = getTelegramUserId(res);
      if (!telegramUserId) {
        res.status(401).json({ message: 'Unauthorized: Telegram user context is missing' });
        return;
      }

      const { id } = req.params;
      const summary = await this.sessionService.getCombatSummary(id, telegramUserId);
      res.status(200).json(summary);
    } catch (error) {
      if (error instanceof Error && error.message.includes('Forbidden')) {
        res.status(403).json({ message: error.message });
      } else if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'Error retrieving combat summary', error });
      }
    }
  }

  public async getCombatCapabilities(req: Request, res: Response): Promise<void> {
    try {
      const telegramUserId = getTelegramUserId(res);
      if (!telegramUserId) {
        res.status(401).json({ message: 'Unauthorized: Telegram user context is missing' });
        return;
      }

      const { id } = req.params;
      const result = await this.sessionService.getCombatCapabilities(id, telegramUserId);
      res.status(200).json(result);
    } catch (error) {
      if (error instanceof Error && error.message.includes('Forbidden')) {
        res.status(403).json({ message: error.message });
      } else if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'Error retrieving combat capabilities', error });
      }
    }
  }

  public async getStatusTemplates(req: Request, res: Response): Promise<void> {
    try {
      const telegramUserId = getTelegramUserId(res);
      if (!telegramUserId) {
        res.status(401).json({ message: 'Unauthorized: Telegram user context is missing' });
        return;
      }

      const { id } = req.params;
      const templates = await this.sessionService.getStatusTemplates(id, telegramUserId);
      res.status(200).json({ items: templates });
    } catch (error) {
      if (error instanceof Error && error.message.includes('Forbidden')) {
        res.status(403).json({ message: error.message });
      } else if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'Error retrieving status templates', error });
      }
    }
  }

  public async getSessionMonsters(req: Request, res: Response): Promise<void> {
    try {
      const telegramUserId = getTelegramUserId(res);
      if (!telegramUserId) {
        res.status(401).json({ message: 'Unauthorized: Telegram user context is missing' });
        return;
      }

      const { id } = req.params;
      const monsters = await this.sessionService.getSessionMonsters(id, telegramUserId);
      res.status(200).json(monsters);
    } catch (error) {
      if (error instanceof Error && error.message.includes('Forbidden')) {
        res.status(403).json({ message: error.message });
      } else if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'Error retrieving session monsters', error });
      }
    }
  }

  public async addSessionMonsters(req: Request, res: Response): Promise<void> {
    try {
      const telegramUserId = getTelegramUserId(res);
      if (!telegramUserId) {
        res.status(401).json({ message: 'Unauthorized: Telegram user context is missing' });
        return;
      }

      const { id } = req.params;
      const { monsterTemplateId, quantity } = req.body;

      const result = await this.sessionService.addMonstersFromTemplate(id, telegramUserId, {
        monsterTemplateId,
        quantity,
      });

      res.status(201).json(result);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Validation:')) {
        res.status(400).json({ message: error.message });
      } else if (error instanceof Error && error.message.includes('Forbidden')) {
        res.status(403).json({ message: error.message });
      } else if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'Error adding monsters to session', error });
      }
    }
  }

  public async removeSessionMonster(req: Request, res: Response): Promise<void> {
    try {
      const telegramUserId = getTelegramUserId(res);
      if (!telegramUserId) {
        res.status(401).json({ message: 'Unauthorized: Telegram user context is missing' });
        return;
      }

      const { id, monsterId } = req.params;
      const result = await this.sessionService.removeSessionMonster(id, monsterId, telegramUserId);
      res.status(200).json(result);
    } catch (error) {
      if (error instanceof Error && error.message.includes('Forbidden')) {
        res.status(403).json({ message: error.message });
      } else if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'Error removing session monster', error });
      }
    }
  }

  public async attachCharacter(req: Request, res: Response): Promise<void> {
    try {
      const telegramUserId = getTelegramUserId(res);
      if (!telegramUserId) {
        res.status(401).json({ message: 'Unauthorized: Telegram user context is missing' });
        return;
      }

      const { id } = req.params;
      const { characterId, currentHp, maxHpSnapshot, tempHp } = req.body;

      if (!characterId || typeof characterId !== 'string') {
        res.status(400).json({ message: 'characterId is required' });
        return;
      }

      const result = await this.sessionService.attachCharacterToSession(id, characterId, telegramUserId, {
        currentHp,
        maxHpSnapshot,
        tempHp,
      });

      res.status(201).json(result);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Validation:')) {
        res.status(400).json({ message: error.message });
      } else if (error instanceof Error && error.message.includes('Forbidden')) {
        res.status(403).json({ message: error.message });
      } else if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'Error attaching character to session', error });
      }
    }
  }

  public async removeCharacter(req: Request, res: Response): Promise<void> {
    try {
      const telegramUserId = getTelegramUserId(res);
      if (!telegramUserId) {
        res.status(401).json({ message: 'Unauthorized: Telegram user context is missing' });
        return;
      }

      const { id, characterId } = req.params;
      const result = await this.sessionService.removeCharacterFromSession(id, characterId, telegramUserId);
      res.status(200).json(result);
    } catch (error) {
      if (error instanceof Error && error.message.includes('Forbidden')) {
        res.status(403).json({ message: error.message });
      } else if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'Error removing character from session', error });
      }
    }
  }

  public async setHp(req: Request, res: Response): Promise<void> {
    try {
      const telegramUserId = getTelegramUserId(res);
      if (!telegramUserId) {
        res.status(401).json({ message: 'Unauthorized: Telegram user context is missing' });
        return;
      }

      const { sessionId, characterId } = req.params;
      const { currentHp, tempHp } = req.body;

      if (currentHp === undefined) {
        res.status(400).json({ message: 'currentHp is required' });
        return;
      }

      const state = await this.sessionService.setSessionCharacterHp(
        sessionId,
        characterId,
        telegramUserId,
        currentHp,
        tempHp
      );

      res.status(200).json(state);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Validation:')) {
        res.status(400).json({ message: error.message });
      } else if (error instanceof Error && error.message.includes('Forbidden')) {
        res.status(403).json({ message: error.message });
      } else if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'Error setting session character HP', error });
      }
    }
  }

  public async setMonsterHp(req: Request, res: Response): Promise<void> {
    try {
      const telegramUserId = getTelegramUserId(res);
      if (!telegramUserId) {
        res.status(401).json({ message: 'Unauthorized: Telegram user context is missing' });
        return;
      }

      const { sessionId, monsterId } = req.params;
      const { currentHp } = req.body;

      if (currentHp === undefined) {
        res.status(400).json({ message: 'currentHp is required' });
        return;
      }

      const monster = await this.sessionService.setSessionMonsterHp(
        sessionId,
        monsterId,
        telegramUserId,
        currentHp
      );

      res.status(200).json(monster);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Validation:')) {
        res.status(400).json({ message: error.message });
      } else if (error instanceof Error && error.message.includes('Forbidden')) {
        res.status(403).json({ message: error.message });
      } else if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'Error setting session monster HP', error });
      }
    }
  }

  public async setInitiative(req: Request, res: Response): Promise<void> {
    try {
      const telegramUserId = getTelegramUserId(res);
      if (!telegramUserId) {
        res.status(401).json({ message: 'Unauthorized: Telegram user context is missing' });
        return;
      }

      const { sessionId, characterId } = req.params;
      const { initiative } = req.body;

      if (initiative === undefined) {
        res.status(400).json({ message: 'initiative is required' });
        return;
      }

      const state = await this.sessionService.setSessionCharacterInitiative(
        sessionId,
        characterId,
        telegramUserId,
        initiative
      );

      res.status(200).json(state);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Validation:')) {
        res.status(400).json({ message: error.message });
      } else if (error instanceof Error && error.message.includes('Forbidden')) {
        res.status(403).json({ message: error.message });
      } else if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'Error setting initiative', error });
      }
    }
  }

  public async rollInitiativeAll(req: Request, res: Response): Promise<void> {
    try {
      const telegramUserId = getTelegramUserId(res);
      if (!telegramUserId) {
        res.status(401).json({ message: 'Unauthorized: Telegram user context is missing' });
        return;
      }

      const { id } = req.params;
      const result = await this.sessionService.rollInitiativeForAll(id, telegramUserId);
      res.status(200).json(result);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Validation:')) {
        res.status(400).json({ message: error.message });
      } else if (error instanceof Error && error.message.includes('Forbidden')) {
        res.status(403).json({ message: error.message });
      } else if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'Error rolling initiative for all characters', error });
      }
    }
  }

  public async rollInitiativeCharacters(req: Request, res: Response): Promise<void> {
    try {
      const telegramUserId = getTelegramUserId(res);
      if (!telegramUserId) {
        res.status(401).json({ message: 'Unauthorized: Telegram user context is missing' });
        return;
      }

      const { id } = req.params;
      const result = await this.sessionService.rollInitiativeForCharacters(id, telegramUserId);
      res.status(200).json(result);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Validation:')) {
        res.status(400).json({ message: error.message });
      } else if (error instanceof Error && error.message.includes('Forbidden')) {
        res.status(403).json({ message: error.message });
      } else if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'Error rolling initiative for characters', error });
      }
    }
  }

  public async rollInitiativeMonsters(req: Request, res: Response): Promise<void> {
    try {
      const telegramUserId = getTelegramUserId(res);
      if (!telegramUserId) {
        res.status(401).json({ message: 'Unauthorized: Telegram user context is missing' });
        return;
      }

      const { id } = req.params;
      const result = await this.sessionService.rollInitiativeForMonsters(id, telegramUserId);
      res.status(200).json(result);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Validation:')) {
        res.status(400).json({ message: error.message });
      } else if (error instanceof Error && error.message.includes('Forbidden')) {
        res.status(403).json({ message: error.message });
      } else if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'Error rolling initiative for monsters', error });
      }
    }
  }

  public async rollInitiativeSelf(req: Request, res: Response): Promise<void> {
    try {
      const telegramUserId = getTelegramUserId(res);
      if (!telegramUserId) {
        res.status(401).json({ message: 'Unauthorized: Telegram user context is missing' });
        return;
      }

      const { id } = req.params;
      const { characterId } = req.body;

      if (!characterId || typeof characterId !== 'string') {
        res.status(400).json({ message: 'characterId is required' });
        return;
      }

      const result = await this.sessionService.rollInitiativeForOwnedCharacter(id, characterId, telegramUserId);
      res.status(200).json(result);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Validation:')) {
        res.status(400).json({ message: error.message });
      } else if (error instanceof Error && error.message.includes('Forbidden')) {
        res.status(403).json({ message: error.message });
      } else if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'Error rolling initiative for owned character', error });
      }
    }
  }

  public async lockInitiative(req: Request, res: Response): Promise<void> {
    try {
      const telegramUserId = getTelegramUserId(res);
      if (!telegramUserId) {
        res.status(401).json({ message: 'Unauthorized: Telegram user context is missing' });
        return;
      }

      const { id } = req.params;
      const result = await this.sessionService.lockSessionInitiative(id, telegramUserId);
      res.status(200).json(result);
    } catch (error) {
      if (error instanceof Error && error.message.includes('Forbidden')) {
        res.status(403).json({ message: error.message });
      } else if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'Error locking initiative', error });
      }
    }
  }

  public async unlockInitiative(req: Request, res: Response): Promise<void> {
    try {
      const telegramUserId = getTelegramUserId(res);
      if (!telegramUserId) {
        res.status(401).json({ message: 'Unauthorized: Telegram user context is missing' });
        return;
      }

      const { id } = req.params;
      const result = await this.sessionService.unlockSessionInitiative(id, telegramUserId);
      res.status(200).json(result);
    } catch (error) {
      if (error instanceof Error && error.message.includes('Forbidden')) {
        res.status(403).json({ message: error.message });
      } else if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'Error unlocking initiative', error });
      }
    }
  }

  public async resetInitiative(req: Request, res: Response): Promise<void> {
    try {
      const telegramUserId = getTelegramUserId(res);
      if (!telegramUserId) {
        res.status(401).json({ message: 'Unauthorized: Telegram user context is missing' });
        return;
      }

      const { id } = req.params;
      const result = await this.sessionService.resetSessionInitiative(id, telegramUserId);
      res.status(200).json(result);
    } catch (error) {
      if (error instanceof Error && error.message.includes('Forbidden')) {
        res.status(403).json({ message: error.message });
      } else if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'Error resetting initiative', error });
      }
    }
  }

  public async startEncounter(req: Request, res: Response): Promise<void> {
    try {
      const telegramUserId = getTelegramUserId(res);
      if (!telegramUserId) {
        res.status(401).json({ message: 'Unauthorized: Telegram user context is missing' });
        return;
      }

      const { id } = req.params;
      const result = await this.sessionService.startEncounter(id, telegramUserId);
      res.status(200).json(result);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Validation:')) {
        res.status(400).json({ message: error.message });
      } else if (error instanceof Error && error.message.includes('Forbidden')) {
        res.status(403).json({ message: error.message });
      } else if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'Error starting encounter', error });
      }
    }
  }

  public async nextEncounterTurn(req: Request, res: Response): Promise<void> {
    try {
      const telegramUserId = getTelegramUserId(res);
      if (!telegramUserId) {
        res.status(401).json({ message: 'Unauthorized: Telegram user context is missing' });
        return;
      }

      const { id } = req.params;
      const result = await this.sessionService.nextEncounterTurn(id, telegramUserId);
      res.status(200).json(result);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Validation:')) {
        res.status(400).json({ message: error.message });
      } else if (error instanceof Error && error.message.includes('Forbidden')) {
        res.status(403).json({ message: error.message });
      } else if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'Error advancing encounter turn', error });
      }
    }
  }

  public async undoLastCombatAction(req: Request, res: Response): Promise<void> {
    try {
      const telegramUserId = getTelegramUserId(res);
      if (!telegramUserId) {
        res.status(401).json({ message: 'Unauthorized: Telegram user context is missing' });
        return;
      }

      const { id } = req.params;
      const result = await this.sessionService.undoLastCombatAction(id, telegramUserId);
      res.status(200).json(result);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Validation:')) {
        res.status(400).json({ message: error.message });
      } else if (error instanceof Error && error.message.includes('Forbidden')) {
        res.status(403).json({ message: error.message });
      } else if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'Error undoing last combat action', error });
      }
    }
  }

  public async endEncounter(req: Request, res: Response): Promise<void> {
    try {
      const telegramUserId = getTelegramUserId(res);
      if (!telegramUserId) {
        res.status(401).json({ message: 'Unauthorized: Telegram user context is missing' });
        return;
      }

      const { id } = req.params;
      const result = await this.sessionService.endEncounter(id, telegramUserId);
      res.status(200).json(result);
    } catch (error) {
      if (error instanceof Error && error.message.includes('Forbidden')) {
        res.status(403).json({ message: error.message });
      } else if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'Error ending encounter', error });
      }
    }
  }

  public async applyEffect(req: Request, res: Response): Promise<void> {
    try {
      const telegramUserId = getTelegramUserId(res);
      if (!telegramUserId) {
        res.status(401).json({ message: 'Unauthorized: Telegram user context is missing' });
        return;
      }

      const { sessionId, characterId } = req.params;
      const { effectType, duration, payload } = req.body;

      const effect = await this.sessionService.applySessionCharacterEffect(
        sessionId,
        characterId,
        telegramUserId,
        effectType,
        duration,
        payload ?? {}
      );

      res.status(201).json(effect);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Validation:')) {
        res.status(400).json({ message: error.message });
      } else if (error instanceof Error && error.message.includes('Forbidden')) {
        res.status(403).json({ message: error.message });
      } else if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'Error applying effect', error });
      }
    }
  }

  public async applyMonsterEffect(req: Request, res: Response): Promise<void> {
    try {
      const telegramUserId = getTelegramUserId(res);
      if (!telegramUserId) {
        res.status(401).json({ message: 'Unauthorized: Telegram user context is missing' });
        return;
      }

      const { sessionId, monsterId } = req.params;
      const { effectType, duration, payload } = req.body;

      const effect = await this.sessionService.applySessionMonsterEffect(
        sessionId,
        monsterId,
        telegramUserId,
        effectType,
        duration,
        payload ?? {}
      );

      res.status(201).json(effect);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Validation:')) {
        res.status(400).json({ message: error.message });
      } else if (error instanceof Error && error.message.includes('Forbidden')) {
        res.status(403).json({ message: error.message });
      } else if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'Error applying monster effect', error });
      }
    }
  }

  public async removeEffect(req: Request, res: Response): Promise<void> {
    try {
      const telegramUserId = getTelegramUserId(res);
      if (!telegramUserId) {
        res.status(401).json({ message: 'Unauthorized: Telegram user context is missing' });
        return;
      }

      const { sessionId, characterId, effectId } = req.params;

      const result = await this.sessionService.removeSessionCharacterEffect(
        sessionId,
        characterId,
        effectId,
        telegramUserId
      );

      res.status(200).json(result);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Validation:')) {
        res.status(400).json({ message: error.message });
      } else if (error instanceof Error && error.message.includes('Forbidden')) {
        res.status(403).json({ message: error.message });
      } else if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'Error removing effect', error });
      }
    }
  }

  public async removeMonsterEffect(req: Request, res: Response): Promise<void> {
    try {
      const telegramUserId = getTelegramUserId(res);
      if (!telegramUserId) {
        res.status(401).json({ message: 'Unauthorized: Telegram user context is missing' });
        return;
      }

      const { sessionId, monsterId, effectId } = req.params;

      const result = await this.sessionService.removeSessionMonsterEffect(
        sessionId,
        monsterId,
        effectId,
        telegramUserId
      );

      res.status(200).json(result);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Validation:')) {
        res.status(400).json({ message: error.message });
      } else if (error instanceof Error && error.message.includes('Forbidden')) {
        res.status(403).json({ message: error.message });
      } else if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'Error removing monster effect', error });
      }
    }
  }

  public async executeCombatAction(req: Request, res: Response): Promise<void> {
    try {
      const telegramUserId = getTelegramUserId(res);
      if (!telegramUserId) {
        res.status(401).json({ message: 'Unauthorized: Telegram user context is missing' });
        return;
      }

      const { id } = req.params;
      const { idempotencyKey, actionType, payload } = req.body;

      const result = await this.sessionService.executeCombatAction(
        id,
        telegramUserId,
        String(idempotencyKey || ''),
        actionType,
        payload || {}
      );

      res.status(200).json(result);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Validation:')) {
        res.status(400).json({ message: error.message });
      } else if (error instanceof Error && error.message.includes('Forbidden')) {
        res.status(403).json({ message: error.message });
      } else if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'Error executing combat action', error });
      }
    }
  }

  public async executeCombatCapability(req: Request, res: Response): Promise<void> {
    try {
      const telegramUserId = getTelegramUserId(res);
      if (!telegramUserId) {
        res.status(401).json({ message: 'Unauthorized: Telegram user context is missing' });
        return;
      }

      const { id } = req.params;
      const {
        idempotencyKey,
        sessionCharacterId,
        capabilityId,
        targetType,
        targetRefId,
        payloadOverride,
      } = req.body;

      const result = await this.sessionService.executeCombatCapability(id, telegramUserId, {
        idempotencyKey,
        sessionCharacterId,
        capabilityId,
        targetType,
        targetRefId,
        payloadOverride,
      });

      res.status(200).json(result);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Validation:')) {
        res.status(400).json({ message: error.message });
      } else if (error instanceof Error && error.message.includes('Forbidden')) {
        res.status(403).json({ message: error.message });
      } else if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'Error executing combat capability', error });
      }
    }
  }

  public async openReactionWindow(req: Request, res: Response): Promise<void> {
    try {
      const telegramUserId = getTelegramUserId(res);
      if (!telegramUserId) {
        res.status(401).json({ message: 'Unauthorized: Telegram user context is missing' });
        return;
      }

      const { id } = req.params;
      const { targetType, targetRefId, reactionType, ttlSeconds } = req.body;
      const result = await this.sessionService.openReactionWindow(id, telegramUserId, {
        targetType,
        targetRefId,
        reactionType,
        ttlSeconds,
      });

      res.status(201).json(result);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Validation:')) {
        res.status(400).json({ message: error.message });
      } else if (error instanceof Error && error.message.includes('Forbidden')) {
        res.status(403).json({ message: error.message });
      } else if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'Error opening reaction window', error });
      }
    }
  }

  public async respondReactionWindow(req: Request, res: Response): Promise<void> {
    try {
      const telegramUserId = getTelegramUserId(res);
      if (!telegramUserId) {
        res.status(401).json({ message: 'Unauthorized: Telegram user context is missing' });
        return;
      }

      const { id, reactionId } = req.params;
      const { responsePayload } = req.body;
      const result = await this.sessionService.respondReactionWindow(
        id,
        reactionId,
        telegramUserId,
        responsePayload || {}
      );

      res.status(200).json(result);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Validation:')) {
        res.status(400).json({ message: error.message });
      } else if (error instanceof Error && error.message.includes('Forbidden')) {
        res.status(403).json({ message: error.message });
      } else if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'Error responding reaction window', error });
      }
    }
  }
}

export default SessionController;
