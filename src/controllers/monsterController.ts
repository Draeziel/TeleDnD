import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { MonsterService } from '../services/monsterService';

function getTelegramUserId(res: Response): string | null {
  const telegramUserId = res.locals.telegramUserId;
  if (!telegramUserId) {
    return null;
  }

  return String(telegramUserId);
}

export class MonsterController {
  private monsterService: MonsterService;

  constructor(prisma: PrismaClient) {
    this.monsterService = new MonsterService(prisma);
  }

  public async listTemplates(req: Request, res: Response): Promise<void> {
    try {
      const telegramUserId = getTelegramUserId(res);
      if (!telegramUserId) {
        res.status(401).json({ message: 'Unauthorized: Telegram user context is missing' });
        return;
      }

      const query = typeof req.query.query === 'string' ? req.query.query : undefined;
      const scope = typeof req.query.scope === 'string' ? req.query.scope : undefined;

      const payload = await this.monsterService.listTemplates(telegramUserId, query, scope);
      res.status(200).json(payload);
    } catch (error) {
      res.status(500).json({ message: 'Error listing monster templates', error });
    }
  }

  public async createTemplate(req: Request, res: Response): Promise<void> {
    try {
      const telegramUserId = getTelegramUserId(res);
      if (!telegramUserId) {
        res.status(401).json({ message: 'Unauthorized: Telegram user context is missing' });
        return;
      }

      const result = await this.monsterService.createTemplate(telegramUserId, req.body || {});
      res.status(201).json(result);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Validation:')) {
        res.status(400).json({ message: error.message });
      } else if (error instanceof Error && error.message.includes('Forbidden')) {
        res.status(403).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'Error creating monster template', error });
      }
    }
  }
}

export default MonsterController;
