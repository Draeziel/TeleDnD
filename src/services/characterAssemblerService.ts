import { PrismaClient } from '@prisma/client';
import { CapabilityResolverService } from './capabilityResolverService';
import { CharacterSheetService } from './characterSheetService';

export class CharacterAssemblerService {
  private prisma?: PrismaClient;
  private capabilityResolver?: CapabilityResolverService;
  private sheetService?: CharacterSheetService;

  constructor(prisma?: PrismaClient, capabilityResolver?: CapabilityResolverService) {
    this.prisma = prisma;
    this.capabilityResolver = capabilityResolver ?? (prisma ? new CapabilityResolverService(prisma) : undefined);
    this.sheetService = prisma ? new CharacterSheetService(prisma) : undefined;
  }

  async assembleCharacter(characterId: string, options?: { testSeed?: any }) {
    if (options?.testSeed) {
      const assembledFromSeed = this.assembleFromSeed(options.testSeed);
      await this.validateAssembled(assembledFromSeed, undefined, options);
      return assembledFromSeed;
    }

    if (!this.prisma || !this.sheetService || !this.capabilityResolver) {
      throw new Error('Prisma client required for DB-backed assembly');
    }

    // Real DB-backed assembly will be implemented in iteration 1.
    const sheet = await this.sheetService.buildCharacterSheet(characterId);

    const characterRecord = await this.prisma.character.findUnique({
      where: { id: characterId },
      include: { owner: { select: { telegramId: true } } },
    });

    if (!characterRecord) {
      throw new Error(`Character with ID ${characterId} not found`);
    }

    const ownerTelegramId = characterRecord.owner?.telegramId;
    if (!ownerTelegramId) {
      throw new Error('Owner telegram id missing for capability resolution');
    }

    const resolved = await this.capabilityResolver.resolveCharacterCapabilities(characterId, ownerTelegramId, {
      dirtyNodeIds: ['sheet:build'],
    });

    const capabilities = resolved.actions.map((cap: any) => ({
      id: cap.id,
      name: typeof cap.payload?.name === 'string' ? cap.payload.name : cap.id,
      payloadType: cap.payloadType,
      payload: cap.payload,
      sourceType: cap.sourceType,
      sourceId: cap.sourceId,
      trigger: cap.trigger || null,
    }));

    const assembled = {
      characterSheetVersion: '1.0.0',
      header: {
        id: sheet.character.id,
        name: sheet.character.name,
        level: sheet.character.level,
        class: sheet.character.class,
      },
      abilities: {
        base: sheet.abilityScores?.base ?? null,
        effective: sheet.abilityScores?.effective ?? null,
      },
      skills: sheet.skills ?? [],
      savingThrows: sheet.savingThrows ?? [],
      derivedStats: sheet.derivedStats ?? {},
      inventory: sheet.inventory ?? [],
      equipment: sheet.equippedItems ?? [],
      capabilities,
      activeEffects: [],
      unresolvedChoices: Array.isArray(sheet.missingChoices) ? sheet.missingChoices.length : 0,
    };

    await this.validateAssembled(assembled, characterId, options);
    return assembled;
  }

  private async validateAssembled(assembled: any, characterId?: string, options?: { testSeed?: any }) {
    const missing: string[] = [];
    if (!assembled.header || !assembled.header.id) missing.push('header');
    if (!assembled.abilities || !assembled.abilities.base || !assembled.abilities.effective) missing.push('abilities');
    if (!Array.isArray(assembled.skills)) missing.push('skills');
    if (!Array.isArray(assembled.savingThrows)) missing.push('savingThrows');
    if (!assembled.derivedStats) missing.push('derivedStats');
    if (!Array.isArray(assembled.inventory)) missing.push('inventory');
    if (!Array.isArray(assembled.equipment)) missing.push('equipment');
    if (!Array.isArray(assembled.capabilities)) missing.push('capabilities');
    if (typeof assembled.unresolvedChoices !== 'number') missing.push('unresolvedChoices');

    if (missing.length > 0) {
      throw new Error(`Assembly incomplete, missing fields: ${missing.join(', ')}`);
    }

    if (assembled.unresolvedChoices > 0) {
      throw new Error('Assembly incomplete: unresolved choices remain');
    }

    // Equipment validation: ensure no slot conflicts (only one equipped item per slot)
    const slotCounts: Record<string, number> = {};
    for (const e of assembled.equipment) {
      const slot = e?.item?.slot ?? 'unspecified';
      slotCounts[slot] = (slotCounts[slot] || 0) + 1;
      if (slotCounts[slot] > 1) {
        throw new Error(`Invalid equipment: multiple items equipped in slot '${slot}'`);
      }
    }

    // Equipment proficiency validation
    let profSet = new Set<string>();
    if (options?.testSeed) {
      const seedProfs = options.testSeed.proficiencies || [];
      profSet = new Set(Array.isArray(seedProfs) ? seedProfs : []);
    } else if (characterId && this.prisma) {
      const charSkillProfs = await this.prisma.characterSkillProficiency.findMany({ where: { characterId } });
      profSet = new Set(charSkillProfs.map(p => p.skillId));
    }

    for (const e of assembled.equipment) {
      const req = (e?.item as any)?.proficiencyRequirements;
      if (!req) continue;

      if (typeof req === 'object' && Array.isArray((req as any).skillIds)) {
        const need: string[] = (req as any).skillIds;
        for (const sid of need) {
          if (!profSet.has(sid)) {
            throw new Error(`Invalid equipment: missing proficiency '${sid}' for item '${e.item?.id || 'unknown'}'`);
          }
        }
      }
    }
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
