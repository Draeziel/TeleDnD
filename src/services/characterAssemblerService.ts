import { PrismaClient } from '@prisma/client';
import { CapabilityResolverService } from './capabilityResolverService';

export class CharacterAssemblerService {
  private prisma?: PrismaClient;
  private capabilityResolver?: CapabilityResolverService;

  constructor(prisma?: PrismaClient, capabilityResolver?: CapabilityResolverService) {
    this.prisma = prisma;
    this.capabilityResolver = capabilityResolver ?? (prisma ? new CapabilityResolverService(prisma) : undefined);
  }

  async assembleCharacter(characterId: string, options?: { testSeed?: any }) {
    if (options?.testSeed) {
      return this.assembleFromSeed(options.testSeed);
    }

    if (!this.prisma) {
      throw new Error('Prisma client not provided');
    }

    // Real DB-backed assembly will be implemented in iteration 1.
    throw new Error('Not implemented: assembleCharacter requires DB access');
  }

  private assembleFromSeed(seed: any) {
    return {
      characterSheetVersion: seed.characterSheetVersion || '1.0.0',
      header: seed.header || {},
      abilities: seed.abilities || { base: {}, effective: {} },
      skills: seed.skills || [],
      savingThrows: seed.savingThrows || [],
      derivedStats: seed.derivedStats || {},
      inventory: seed.inventory || [],
      equipment: seed.equipment || [],
      capabilities: seed.capabilities || [],
      activeEffects: seed.activeEffects || [],
      unresolvedChoices: typeof seed.unresolvedChoices === 'number' ? seed.unresolvedChoices : 0,
    };
  }
}

export default CharacterAssemblerService;
