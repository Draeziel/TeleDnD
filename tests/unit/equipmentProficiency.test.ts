import CharacterAssemblerService from '../../src/services/characterAssemblerService';

async function run() {
  const assembler = new CharacterAssemblerService();

  const seedFail = {
    characterSheetVersion: '1.0.0',
    header: { id: 'c1', name: 'NoPro', level: 1, class: { id: 'c1', name: 'Fighter' } },
    abilities: { base: {}, effective: {} },
    skills: [],
    savingThrows: [],
    derivedStats: {},
    inventory: [],
    equipment: [{ id: 'ci1', item: { id: 'i1', name: 'Sword', slot: 'hand', proficiencyRequirements: { skillIds: ['sword-proficiency'] } }, equipped: true }],
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
    console.error('equipmentProficiency test (fail case): expected error but none thrown');
    process.exit(1);
  }

  const seedPass: any = Object.assign({}, seedFail, { header: { id: 'c2', name: 'Pro', level: 1, class: { id: 'c1', name: 'Fighter' } }, });
  seedPass.proficiencies = ['sword-proficiency'];

  try {
    const sheet = await assembler.assembleCharacter('seed', { testSeed: seedPass });
    console.log('equipmentProficiency test: PASS');
  } catch (err) {
    console.error('equipmentProficiency test (pass case) failed', err);
    process.exit(1);
  }
}

run().catch(err => { console.error(err); process.exit(1); });
