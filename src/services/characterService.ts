import { PrismaClient } from '@prisma/client';

export class CharacterService {
    private prisma: PrismaClient;

    constructor(prisma: PrismaClient) {
        this.prisma = prisma;
    }

    async fetchClasses() {
        return await this.prisma.class.findMany({
            include: {
                contentSource: true,
            },
        });
    }

    async fetchCharacters() {
        return await this.prisma.character.findMany({
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

    async addCharacter(characterData: any) {
        return await this.prisma.character.create({
            data: characterData,
            include: {
                class: true,
            },
        });
    }

    async fetchCharacter(characterId: string) {
        return await this.prisma.character.findUnique({
            where: { id: characterId },
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

    async saveCharacterChoices(characterId: string, choices: any[]) {
        const createdChoices = await this.prisma.characterChoice.createMany({
            data: choices.map(choice => ({
                characterId: characterId,
                choiceId: choice.choiceId,
                selectedOption: choice.selectedOption,
            })),
        });

        return await this.fetchCharacter(characterId);
    }
}