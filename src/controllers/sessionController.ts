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

      const session = await this.sessionService.createSession(name.trim(), telegramUserId);
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
}

export default SessionController;
