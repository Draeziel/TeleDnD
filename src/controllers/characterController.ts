import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { CharacterService } from '../services/characterService';
import { CharacterSheetService } from '../services/characterSheetService';
import { InventoryService } from '../services/inventoryService';
import { CapabilityResolverService } from '../services/capabilityResolverService';

function getTelegramUserId(res: Response): string | null {
    const telegramUserId = res.locals.telegramUserId;
    if (!telegramUserId) {
        return null;
    }

    return String(telegramUserId);
}

export class CharacterController {
    private characterService: CharacterService;
    private characterSheetService: CharacterSheetService;
    private inventoryService: InventoryService;
    private capabilityResolverService: CapabilityResolverService;

    constructor(prisma: PrismaClient) {
        this.characterService = new CharacterService(prisma);
        this.characterSheetService = new CharacterSheetService(prisma);
        this.inventoryService = new InventoryService(prisma);
        this.capabilityResolverService = new CapabilityResolverService(prisma);
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
            const telegramUserId = getTelegramUserId(res);
            if (!telegramUserId) {
                res.status(401).json({ message: 'Unauthorized: Telegram user context is missing' });
                return;
            }

            const characters = await this.characterService.fetchCharacters(telegramUserId);
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
            const telegramUserId = getTelegramUserId(res);
            if (!telegramUserId) {
                res.status(401).json({ message: 'Unauthorized: Telegram user context is missing' });
                return;
            }

            const characterData = req.body;
            const newCharacter = await this.characterService.addCharacter(characterData, telegramUserId);
            res.status(201).json(newCharacter);
        } catch (error) {
            res.status(500).json({ message: 'Error creating character', error });
        }
    }

    public async getCharacter(req: Request, res: Response): Promise<void> {
        try {
            const telegramUserId = getTelegramUserId(res);
            if (!telegramUserId) {
                res.status(401).json({ message: 'Unauthorized: Telegram user context is missing' });
                return;
            }

            const characterId = req.params.id;
            const character = await this.characterService.fetchCharacter(characterId, telegramUserId);
            if (character) {
                res.status(200).json(character);
            } else {
                res.status(404).json({ message: 'Character not found' });
            }
        } catch (error) {
            res.status(500).json({ message: 'Error retrieving character', error });
        }
    }

    public async deleteCharacter(req: Request, res: Response): Promise<void> {
        try {
            const telegramUserId = getTelegramUserId(res);
            if (!telegramUserId) {
                res.status(401).json({ message: 'Unauthorized: Telegram user context is missing' });
                return;
            }

            const characterId = req.params.id;
            await this.characterService.deleteCharacter(characterId, telegramUserId);
            res.status(200).json({ message: 'Character deleted successfully' });
        } catch (error) {
            if (error instanceof Error && error.message.includes('Character not found')) {
                res.status(404).json({ message: 'Character not found' });
            } else {
                res.status(500).json({ message: 'Error deleting character', error });
            }
        }
    }

    public async getCharacterSheet(req: Request, res: Response): Promise<void> {
        try {
            const telegramUserId = getTelegramUserId(res);
            if (!telegramUserId) {
                res.status(401).json({ message: 'Unauthorized: Telegram user context is missing' });
                return;
            }

            const characterId = req.params.id;
            const character = await this.characterService.fetchCharacter(characterId, telegramUserId);
            if (!character) {
                res.status(404).json({ message: 'Character not found' });
                return;
            }

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

    public async getCharacterCapabilities(req: Request, res: Response): Promise<void> {
        try {
            const telegramUserId = getTelegramUserId(res);
            if (!telegramUserId) {
                res.status(401).json({ message: 'Unauthorized: Telegram user context is missing' });
                return;
            }

            const characterId = req.params.id;
            const dirtyQuery = req.query.dirtyNodeId;
            const dirtyNodeIds = Array.isArray(dirtyQuery)
                ? dirtyQuery.map((value) => String(value)).filter(Boolean)
                : dirtyQuery
                    ? [String(dirtyQuery)]
                    : [];

            const capabilities = await this.capabilityResolverService.resolveCharacterCapabilities(characterId, telegramUserId, {
                dirtyNodeIds,
            });
            res.status(200).json(capabilities);
        } catch (error) {
            if (error instanceof Error && error.message.includes('not found')) {
                res.status(404).json({ message: error.message });
                return;
            }

            res.status(500).json({ message: 'Error resolving character capabilities', error });
        }
    }

    public async createCharacterChoices(req: Request, res: Response): Promise<void> {
        try {
            const telegramUserId = getTelegramUserId(res);
            if (!telegramUserId) {
                res.status(401).json({ message: 'Unauthorized: Telegram user context is missing' });
                return;
            }

            const characterId = req.params.id || req.body.characterId;
            const { choices } = req.body;

            if (!characterId) {
                res.status(400).json({ message: 'characterId is required' });
                return;
            }

            const updatedCharacter = await this.characterService.saveCharacterChoices(characterId, choices, telegramUserId);
            res.status(200).json(updatedCharacter);
        } catch (error) {
            if (error instanceof Error && error.message.includes('Character not found')) {
                res.status(404).json({ message: 'Character not found' });
                return;
            }

            res.status(500).json({ message: 'Error saving character choices', error });
        }
    }

    public async addItem(req: Request, res: Response): Promise<void> {
        try {
            const telegramUserId = getTelegramUserId(res);
            if (!telegramUserId) {
                res.status(401).json({ message: 'Unauthorized: Telegram user context is missing' });
                return;
            }

            const { id: characterId } = req.params;
            const { itemId } = req.body;

            if (!itemId) {
                res.status(400).json({ message: 'itemId is required' });
                return;
            }

            const character = await this.characterService.fetchCharacter(characterId, telegramUserId);
            if (!character) {
                res.status(404).json({ message: 'Character not found' });
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
            const telegramUserId = getTelegramUserId(res);
            if (!telegramUserId) {
                res.status(401).json({ message: 'Unauthorized: Telegram user context is missing' });
                return;
            }

            const { id: characterId, itemId } = req.params;

            const character = await this.characterService.fetchCharacter(characterId, telegramUserId);
            if (!character) {
                res.status(404).json({ message: 'Character not found' });
                return;
            }

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
            const telegramUserId = getTelegramUserId(res);
            if (!telegramUserId) {
                res.status(401).json({ message: 'Unauthorized: Telegram user context is missing' });
                return;
            }

            const { id: characterId, itemId } = req.params;

            const character = await this.characterService.fetchCharacter(characterId, telegramUserId);
            if (!character) {
                res.status(404).json({ message: 'Character not found' });
                return;
            }

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