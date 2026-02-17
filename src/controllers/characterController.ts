import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { CharacterService } from '../services/characterService';
import { CharacterSheetService } from '../services/characterSheetService';
import { InventoryService } from '../services/inventoryService';

export class CharacterController {
    private characterService: CharacterService;
    private characterSheetService: CharacterSheetService;
    private inventoryService: InventoryService;

    constructor(prisma: PrismaClient) {
        this.characterService = new CharacterService(prisma);
        this.characterSheetService = new CharacterSheetService(prisma);
        this.inventoryService = new InventoryService(prisma);
    }

    public async getClasses(req: Request, res: Response): Promise<void> {
        try {
            const classes = await this.characterService.fetchClasses();
            res.status(200).json(classes);
        } catch (error) {
            res.status(500).json({ message: 'Error retrieving classes', error });
        }
    }

    public async getCharacters(req: Request, res: Response): Promise<void> {
        try {
            const characters = await this.characterService.fetchCharacters();
            res.status(200).json(characters);
        } catch (error) {
            res.status(500).json({ message: 'Error retrieving characters', error });
        }
    }

    public async getRaces(req: Request, res: Response): Promise<void> {
        try {
            const races = await this.characterService.fetchRaces();
            res.status(200).json(races);
        } catch (error) {
            res.status(500).json({ message: 'Error retrieving races', error });
        }
    }

    public async getBackgrounds(req: Request, res: Response): Promise<void> {
        try {
            const backgrounds = await this.characterService.fetchBackgrounds();
            res.status(200).json(backgrounds);
        } catch (error) {
            res.status(500).json({ message: 'Error retrieving backgrounds', error });
        }
    }

    public async createCharacter(req: Request, res: Response): Promise<void> {
        try {
            const characterData = req.body;
            const newCharacter = await this.characterService.addCharacter(characterData);
            res.status(201).json(newCharacter);
        } catch (error) {
            res.status(500).json({ message: 'Error creating character', error });
        }
    }

    public async getCharacter(req: Request, res: Response): Promise<void> {
        try {
            const characterId = req.params.id;
            const character = await this.characterService.fetchCharacter(characterId);
            if (character) {
                res.status(200).json(character);
            } else {
                res.status(404).json({ message: 'Character not found' });
            }
        } catch (error) {
            res.status(500).json({ message: 'Error retrieving character', error });
        }
    }

    public async getCharacterSheet(req: Request, res: Response): Promise<void> {
        try {
            const characterId = req.params.id;
            const sheet = await this.characterSheetService.buildCharacterSheet(characterId);
            res.status(200).json(sheet);
        } catch (error) {
            if (error instanceof Error && error.message.includes('not found')) {
                res.status(404).json({ message: error.message });
            } else {
                res.status(500).json({ message: 'Error retrieving character sheet', error });
            }
        }
    }

    public async createCharacterChoices(req: Request, res: Response): Promise<void> {
        try {
            const { characterId, choices } = req.body;
            const updatedCharacter = await this.characterService.saveCharacterChoices(characterId, choices);
            res.status(200).json(updatedCharacter);
        } catch (error) {
            res.status(500).json({ message: 'Error saving character choices', error });
        }
    }

    public async addItem(req: Request, res: Response): Promise<void> {
        try {
            const { id: characterId } = req.params;
            const { itemId } = req.body;

            if (!itemId) {
                res.status(400).json({ message: 'itemId is required' });
                return;
            }

            const inventoryEntry = await this.inventoryService.addItemToCharacter(characterId, itemId);
            res.status(201).json(inventoryEntry);
        } catch (error) {
            if (error instanceof Error && error.message.includes('Record to update')) {
                res.status(404).json({ message: 'Character or item not found' });
            } else {
                res.status(500).json({ message: 'Error adding item to character', error });
            }
        }
    }

    public async equipItem(req: Request, res: Response): Promise<void> {
        try {
            const { id: characterId, itemId } = req.params;
            const entry = await this.inventoryService.equipItem(characterId, itemId);
            res.status(200).json(entry);
        } catch (error) {
            if (error instanceof Error && error.message.includes('Record to update')) {
                res.status(404).json({ message: 'Character item not found' });
            } else {
                res.status(500).json({ message: 'Error equipping item', error });
            }
        }
    }

    public async unequipItem(req: Request, res: Response): Promise<void> {
        try {
            const { id: characterId, itemId } = req.params;
            const entry = await this.inventoryService.unequipItem(characterId, itemId);
            res.status(200).json(entry);
        } catch (error) {
            if (error instanceof Error && error.message.includes('Record to update')) {
                res.status(404).json({ message: 'Character item not found' });
            } else {
                res.status(500).json({ message: 'Error unequipping item', error });
            }
        }
    }
}

export default CharacterController;