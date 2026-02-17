import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { CharacterController } from '../controllers/characterController';

export default function characterRoutes(prisma: PrismaClient) {
    const router = Router();
    const characterController = new CharacterController(prisma);

    router.get('/', characterController.getCharacters.bind(characterController));
    router.get('/classes', characterController.getClasses.bind(characterController));
    router.get('/races', characterController.getRaces.bind(characterController));
    router.get('/backgrounds', characterController.getBackgrounds.bind(characterController));
    router.post('/', characterController.createCharacter.bind(characterController));
    router.get('/:id', characterController.getCharacter.bind(characterController));
    router.get('/:id/sheet', characterController.getCharacterSheet.bind(characterController));
    router.post('/:id/choices', characterController.createCharacterChoices.bind(characterController));
    router.post('/:id/items', characterController.addItem.bind(characterController));
    router.post('/:id/items/:itemId/equip', characterController.equipItem.bind(characterController));
    router.post('/:id/items/:itemId/unequip', characterController.unequipItem.bind(characterController));

    return router;
}