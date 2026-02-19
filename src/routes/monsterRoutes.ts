import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { MonsterController } from '../controllers/monsterController';

export default function monsterRoutes(prisma: PrismaClient) {
  const router = Router();
  const monsterController = new MonsterController(prisma);

  router.get('/templates', monsterController.listTemplates.bind(monsterController));
  router.post('/templates', monsterController.createTemplate.bind(monsterController));

  return router;
}
