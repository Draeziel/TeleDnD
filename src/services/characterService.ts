import { PrismaClient } from '@prisma/client';

export class CharacterService {
    private prisma: PrismaClient;

    constructor(prisma: PrismaClient) {
        this.prisma = prisma;
    }

    private async resolveUserByTelegramId(telegramUserId: string) {
        return this.prisma.user.upsert({
            where: { telegramId: telegramUserId },
            update: {},
            create: { telegramId: telegramUserId },
        });
    }

    async fetchClasses() {
        return await this.prisma.class.findMany({
            include: {
                contentSource: true,
            },
        });
    }

    async fetchCharacters(telegramUserId: string) {
        const user = await this.resolveUserByTelegramId(telegramUserId);

        return await this.prisma.character.findMany({
            where: {
                ownerUserId: user.id,
            },
            include: {
                class: true,
                race: true,
                background: true,
            },
            orderBy: {
                name: 'asc',
            },
        });
    }

    async fetchRaces() {
        return await this.prisma.race.findMany({
            include: {
                contentSource: true,
            },
            orderBy: {
                name: 'asc',
            },
        });
    }

    async fetchBackgrounds() {
        return await this.prisma.background.findMany({
            include: {
                contentSource: true,
            },
            orderBy: {
                name: 'asc',
            },
        });
    }

    async fetchItems() {
        return await this.prisma.item.findMany({
            include: {
                contentSource: true,
            },
            orderBy: {
                name: 'asc',
            },
        });
    }

    async addCharacter(characterData: any, telegramUserId: string) {
        const user = await this.resolveUserByTelegramId(telegramUserId);

        const { ownerUserId: _ignoredOwnerUserId, ...safeCharacterData } = characterData;

        return await this.prisma.character.create({
            data: {
                ...safeCharacterData,
                ownerUserId: user.id,
            },
            include: {
                class: true,
            },
        });
    }

    async fetchCharacter(characterId: string, telegramUserId: string) {
        const user = await this.resolveUserByTelegramId(telegramUserId);

        return await this.prisma.character.findFirst({
            where: {
                id: characterId,
                ownerUserId: user.id,
            },
            include: {
                class: true,
                characterChoices: {
                    include: {
                        choice: true,
                    },
                },
            },
        });
    }

    async saveCharacterChoices(characterId: string, choices: any[], telegramUserId: string) {
        const character = await this.fetchCharacter(characterId, telegramUserId);

        if (!character) {
            throw new Error('Character not found');
        }

        await this.prisma.characterChoice.createMany({
            data: choices.map(choice => ({
                characterId: characterId,
                choiceId: choice.choiceId,
                selectedOption: choice.selectedOption,
            })),
        });

        return await this.fetchCharacter(characterId, telegramUserId);
    }

    async deleteCharacter(characterId: string, telegramUserId: string) {
        const user = await this.resolveUserByTelegramId(telegramUserId);

        const ownedCharacter = await this.prisma.character.findFirst({
            where: {
                id: characterId,
                ownerUserId: user.id,
            },
            select: { id: true },
        });

        if (!ownedCharacter) {
            throw new Error('Character not found');
        }

        return await this.prisma.character.delete({
            where: { id: ownedCharacter.id },
        });
    }
}