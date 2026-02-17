import { PrismaClient, Skill } from '@prisma/client';

export class SkillService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async getAllSkills(): Promise<Skill[]> {
    return this.prisma.skill.findMany({
      orderBy: {
        name: 'asc',
      },
    });
  }

  async getCharacterSkillProficiencies(characterId: string): Promise<Array<{ skillId: string }>> {
    return this.prisma.characterSkillProficiency.findMany({
      where: { characterId },
      select: {
        skillId: true,
      },
    });
  }
}

export default SkillService;
