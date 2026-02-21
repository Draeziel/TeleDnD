import CharacterAssemblerService from '../../src/services/characterAssemblerService';

async function run() {
  const assembler = new CharacterAssemblerService();

  const seedFail = {
    characterSheetVersion: '1.0.0',
    header: { id: 'c1', name: 'Weak', level: 1, class: { id: 'c1', name: 'Fighter' } },
    abilities: { base: { str: 8 }, effective: { str: 8 } },
    skills: [],
    savingThrows: [],
    derivedStats: {},
    inventory: [],
    equipment: [{ id: 'ci1', item: { id: 'i1', name: 'Greatsword', slot: 'hand', minStrength: 13 }, equipped: true }],
    capabilities: [],
    unresolvedChoices: 0,
  };

  let threw = false;
  try {
    await assembler.assembleCharacter('seed', { testSeed: seedFail });
  } catch (err: any) {
    threw = true;
  }

  if (!threw) {
    console.error('equipmentAttributeRequirement test (fail case): expected error but none thrown');
    process.exit(1);
  }

  const seedPass: any = Object.assign({}, seedFail, { header: { id: 'c2', name: 'Strong', level: 1, class: { id: 'c1', name: 'Fighter' } } });
  seedPass.abilities = { base: { str: 16 }, effective: { str: 16 } };

  try {
    const sheet = await assembler.assembleCharacter('seed', { testSeed: seedPass });
    console.log('equipmentAttributeRequirement test: PASS');
  } catch (err) {
    console.error('equipmentAttributeRequirement test (pass case) failed', err);
    process.exit(1);
  }
}

run().catch(err => { console.error(err); process.exit(1); });
