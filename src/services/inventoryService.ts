import { PrismaClient } from '@prisma/client';

export class InventoryService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async addItemToCharacter(characterId: string, itemId: string) {
    return await this.prisma.characterItem.upsert({
      where: {
        characterId_itemId: {
          characterId,
          itemId,
        },
      },
      update: {},
      create: {
        characterId,
        itemId,
      },
      include: {
        item: true,
      },
    });
  }

  async equipItem(characterId: string, itemId: string) {
    return await this.prisma.characterItem.update({
      where: {
        characterId_itemId: {
          characterId,
          itemId,
        },
      },
      data: {
        equipped: true,
      },
      include: {
        item: true,
      },
    });
  }

  async unequipItem(characterId: string, itemId: string) {
    return await this.prisma.characterItem.update({
      where: {
        characterId_itemId: {
          characterId,
          itemId,
        },
      },
      data: {
        equipped: false,
      },
      include: {
        item: true,
      },
    });
  }

  async getInventory(characterId: string) {
    return await this.prisma.characterItem.findMany({
      where: { characterId },
      include: { item: true },
      orderBy: {
        item: {
          name: 'asc',
        },
      },
    });
  }
}

export default InventoryService;
