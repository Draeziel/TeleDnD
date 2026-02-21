import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { DraftController } from '../controllers/draftController';

export default function draftRoutes(prisma: PrismaClient) {
  const router = Router();
  const draftController = new DraftController(prisma);

  router.post('/', draftController.createDraft.bind(draftController));
  router.get('/:id', draftController.getDraft.bind(draftController));
  router.post('/:id/class', draftController.setClass.bind(draftController));
  router.post('/:id/race', draftController.setRace.bind(draftController));
  router.post('/:id/background', draftController.setBackground.bind(draftController));
  router.post('/:id/ability-scores', draftController.setAbilityScores.bind(draftController));
  router.post('/:id/choices', draftController.saveChoice.bind(draftController));
  router.post('/:id/finalize', draftController.finalizeDraft.bind(draftController));
  router.post('/:id/items', draftController.addItem.bind(draftController));
  router.post('/:id/items/:itemId/equip', draftController.equipItem.bind(draftController));
  router.post('/:id/items/:itemId/unequip', draftController.unequipItem.bind(draftController));

  return router;
}
