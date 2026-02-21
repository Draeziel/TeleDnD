import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { DraftService } from '../services/draftService';

function getTelegramUserId(res: Response): string | null {
  const telegramUserId = res.locals.telegramUserId;
  if (!telegramUserId) {
    return null;
  }

  return String(telegramUserId);
}

export class DraftController {
  private draftService: DraftService;

  constructor(prisma: PrismaClient) {
    this.draftService = new DraftService(prisma);
  }

  /**
   * POST /api/drafts
   * Create a new empty draft
   */
  public async createDraft(req: Request, res: Response): Promise<void> {
    try {
      const { name } = req.body;

      if (!name) {
        res.status(400).json({ message: 'Name is required' });
        return;
      }

      const draft = await this.draftService.createDraft(name);
      res.status(201).json(draft);
    } catch (error) {
      res.status(500).json({ message: 'Error creating draft', error });
    }
  }

  /**
   * GET /api/drafts/:id
   * Get draft with choices
   */
  public async getDraft(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const draft = await this.draftService.getDraft(id);
      res.status(200).json(draft);
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'Error retrieving draft', error });
      }
    }
  }

  /**
   * POST /api/drafts/:id/class
   * Set class for draft
   */
  public async setClass(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { classId } = req.body;

      if (!classId) {
        res.status(400).json({ message: 'classId is required' });
        return;
      }

      const draft = await this.draftService.setClassForDraft(id, classId);
      res.status(200).json(draft);
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'Error setting class', error });
      }
    }
  }

  /**
   * POST /api/drafts/:id/race
   * Set race for draft
   */
  public async setRace(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { raceId } = req.body;

      if (!raceId) {
        res.status(400).json({ message: 'raceId is required' });
        return;
      }

      const draft = await this.draftService.setRaceForDraft(id, raceId);
      res.status(200).json(draft);
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'Error setting race', error });
      }
    }
  }

  /**
   * POST /api/drafts/:id/background
   * Set background for draft
   */
  public async setBackground(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { backgroundId } = req.body;

      if (!backgroundId) {
        res.status(400).json({ message: 'backgroundId is required' });
        return;
      }

      const draft = await this.draftService.setBackgroundForDraft(id, backgroundId);
      res.status(200).json(draft);
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'Error setting background', error });
      }
    }
  }

  /**
   * POST /api/drafts/:id/ability-scores
   * Set ability scores for draft
   */
  public async setAbilityScores(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { method, str, dex, con, int: intScore, wis, cha } = req.body;

      if (!method) {
        res.status(400).json({ message: 'method is required' });
        return;
      }

      if (str === undefined || dex === undefined || con === undefined || 
          intScore === undefined || wis === undefined || cha === undefined) {
        res.status(400).json({ message: 'All ability scores (str, dex, con, int, wis, cha) are required' });
        return;
      }

      const draft = await this.draftService.setAbilityScoresForDraft(id, method, {
        str,
        dex,
        con,
        int: intScore,
        wis,
        cha,
      });
      res.status(200).json(draft);
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ message: error.message });
      } else if (error instanceof Error && 
                 (error.message.includes('Invalid') || 
                  error.message.includes('must be') ||
                  error.message.includes('Unknown'))) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'Error setting ability scores', error });
      }
    }
  }

  /**
   * POST /api/drafts/:id/choices
   * Add or update choice for draft
   */
  public async saveChoice(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { choiceId, selectedOption } = req.body;

      if (!choiceId || !selectedOption) {
        res
          .status(400)
          .json({ message: 'choiceId and selectedOption are required' });
        return;
      }

      const draft = await this.draftService.saveChoiceForDraft(
        id,
        choiceId,
        selectedOption
      );
      res.status(200).json(draft);
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ message: error.message });
      } else if (error instanceof Error && (error.message.includes('Invalid choice selection') || error.message.includes('not available for this draft'))) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'Error saving choice', error });
      }
    }
  }

  public async addItem(req: Request, res: Response): Promise<void> {
    try {
      const { id: draftId } = req.params;
      const { itemId } = req.body;

      if (!itemId) {
        res.status(400).json({ message: 'itemId is required' });
        return;
      }

      const draft = await this.draftService.getDraft(draftId);
      if (!draft) {
        res.status(404).json({ message: 'Draft not found' });
        return;
      }

      const entry = await this.draftService.addItemToDraft(draftId, itemId);
      res.status(201).json(entry);
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'Error adding item to draft', error });
      }
    }
  }

  public async equipItem(req: Request, res: Response): Promise<void> {
    try {
      const { id: draftId, itemId } = req.params;

      const draft = await this.draftService.getDraft(draftId);
      if (!draft) {
        res.status(404).json({ message: 'Draft not found' });
        return;
      }

      const entry = await this.draftService.equipDraftItem(draftId, itemId);
      res.status(200).json(entry);
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'Error equipping draft item', error });
      }
    }
  }

  public async unequipItem(req: Request, res: Response): Promise<void> {
    try {
      const { id: draftId, itemId } = req.params;

      const draft = await this.draftService.getDraft(draftId);
      if (!draft) {
        res.status(404).json({ message: 'Draft not found' });
        return;
      }

      const entry = await this.draftService.unequipDraftItem(draftId, itemId);
      res.status(200).json(entry);
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'Error unequipping draft item', error });
      }
    }
  }

  /**
   * POST /api/drafts/:id/finalize
   * Validate and create character from draft
   */
  public async finalizeDraft(req: Request, res: Response): Promise<void> {
    try {
      const telegramUserId = getTelegramUserId(res);
      if (!telegramUserId) {
        res.status(401).json({ message: 'Unauthorized: Telegram user context is missing' });
        return;
      }

      const { id } = req.params;
      const result = await this.draftService.finalizeDraft(id, telegramUserId);
      res.status(201).json(result);
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ message: error.message });
      } else if (error instanceof Error && (error.message.includes('Cannot finalize') || error.message.includes('Invalid choice selection'))) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'Error finalizing draft', error });
      }
    }
  }
}

export default DraftController;
