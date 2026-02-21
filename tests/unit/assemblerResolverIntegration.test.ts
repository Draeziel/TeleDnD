import assert from 'assert';
import CharacterAssemblerService from '../../src/services/characterAssemblerService';

(async () => {
  // Create a stubbed assembler instance without running the constructor logic.
  const assembler: any = Object.create(CharacterAssemblerService.prototype);

  // Minimal truthy prisma placeholder to satisfy checks and return expected data.
  assembler.prisma = {
    character: {
      findUnique: async () => ({ owner: { telegramId: 'tg:1' } }),
    },
    characterSkillProficiency: {
      findMany: async () => [],
    },
  };

  // Stub capability resolver to return no actions (so file-based caps are the source).
  assembler.capabilityResolver = {
    resolveCharacterCapabilities: async () => ({ actions: [] }),
  };

  // Stub sheetService to return a minimal sheet with class name matching content/classes/barbarian.json
  assembler.sheetService = {
    buildCharacterSheet: async (characterId: string) => ({
      character: {
        id: characterId,
        name: 'Conan',
        level: 1,
        class: { id: 'class:barbarian:1', name: 'Barbarian' },
      },
      abilityScores: { base: { str: 16, dex: 10, con: 14, int: 10, wis: 10, cha: 10 }, effective: { str: 16, dex: 10, con: 14, int: 10, wis: 10, cha: 10 } },
      skills: [],
      savingThrows: [],
      derivedStats: {},
      inventory: [],
      equippedItems: [],
      missingChoices: [],
    }),
  };

  try {
    const assembled = await assembler.assembleCharacter('char-test-1');

    assert(Array.isArray(assembled.capabilities), 'capabilities must be an array');

    const found = assembled.capabilities.find((c: any) => c.id === 'cap:rage:1');
    assert(found, 'Expected capability cap:rage:1 to be present from content files');

    console.log('assemblerResolverIntegration test: PASS');
    process.exit(0);
  } catch (err: any) {
    console.error('assemblerResolverIntegration test: FAIL');
    console.error(err && err.stack ? err.stack : err);
    process.exit(2);
  }
})();
