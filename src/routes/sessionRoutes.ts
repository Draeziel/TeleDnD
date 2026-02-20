import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { SessionController } from '../controllers/sessionController';

export default function sessionRoutes(prisma: PrismaClient) {
  const router = Router();
  const sessionController = new SessionController(prisma);

  router.post('/', sessionController.createSession.bind(sessionController));
  router.get('/', sessionController.listSessions.bind(sessionController));
  router.post('/join', sessionController.joinSession.bind(sessionController));
  router.post('/:id/leave', sessionController.leaveSession.bind(sessionController));
  router.delete('/:id', sessionController.deleteSession.bind(sessionController));
  router.get('/:id/summary', sessionController.getSessionSummary.bind(sessionController));
  router.get('/:id/events', sessionController.getSessionEvents.bind(sessionController));
  router.get('/:id/monsters', sessionController.getSessionMonsters.bind(sessionController));
  router.post('/:id/monsters', sessionController.addSessionMonsters.bind(sessionController));
  router.delete('/:id/monsters/:monsterId', sessionController.removeSessionMonster.bind(sessionController));
  router.post('/:id/initiative/roll-all', sessionController.rollInitiativeAll.bind(sessionController));
  router.post('/:id/initiative/roll-monsters', sessionController.rollInitiativeMonsters.bind(sessionController));
  router.post('/:id/initiative/roll-self', sessionController.rollInitiativeSelf.bind(sessionController));
  router.post('/:id/initiative/lock', sessionController.lockInitiative.bind(sessionController));
  router.post('/:id/initiative/unlock', sessionController.unlockInitiative.bind(sessionController));
  router.post('/:id/initiative/reset', sessionController.resetInitiative.bind(sessionController));
  router.post('/:id/encounter/start', sessionController.startEncounter.bind(sessionController));
  router.post('/:id/encounter/next-turn', sessionController.nextEncounterTurn.bind(sessionController));
  router.post('/:id/encounter/end', sessionController.endEncounter.bind(sessionController));
  router.get('/:id', sessionController.getSession.bind(sessionController));
  router.post('/:id/characters', sessionController.attachCharacter.bind(sessionController));
  router.delete('/:id/characters/:characterId', sessionController.removeCharacter.bind(sessionController));
  router.post('/:sessionId/characters/:characterId/set-hp', sessionController.setHp.bind(sessionController));
  router.post('/:sessionId/characters/:characterId/set-initiative', sessionController.setInitiative.bind(sessionController));
  router.post('/:sessionId/characters/:characterId/apply-effect', sessionController.applyEffect.bind(sessionController));

  return router;
}
