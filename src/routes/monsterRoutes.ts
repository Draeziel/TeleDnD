import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { MonsterController } from '../controllers/monsterController';

export default function monsterRoutes(prisma: PrismaClient) {
  const router = Router();
  const monsterController = new MonsterController(prisma);

  router.get('/templates', monsterController.listTemplates.bind(monsterController));
  router.post('/templates', monsterController.createTemplate.bind(monsterController));
  router.put('/templates/:id', monsterController.updateTemplate.bind(monsterController));
  router.delete('/templates/:id', monsterController.deleteTemplate.bind(monsterController));
  router.get('/status-templates', monsterController.listStatusTemplates.bind(monsterController));
  router.post('/status-templates', monsterController.createStatusTemplate.bind(monsterController));
  router.put('/status-templates/:id', monsterController.updateStatusTemplate.bind(monsterController));
  router.delete('/status-templates/:id', monsterController.deleteStatusTemplate.bind(monsterController));

  return router;
}
