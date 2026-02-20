import CharacterAssemblerService from '../../src/services/characterAssemblerService';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const assembler = new CharacterAssemblerService();

  const seed = {
    characterSheetVersion: '1.0.0',
    header: { id: 'seed-char-1', name: 'Seedy', level: 1, class: { id: 'c1', name: 'Barbarian' } },
    abilities: { base: { str: 15, dex: 12, con: 14, int: 10, wis: 10, cha: 8 }, effective: { str: 15, dex: 12, con: 14, int: 10, wis: 10, cha: 8 } },
    skills: [],
    savingThrows: [],
    derivedStats: { abilityModifiers: { str: 2 } },
    inventory: [],
    equipment: [],
    capabilities: [],
    activeEffects: [],
    unresolvedChoices: 0,
  };

  const sheet = await assembler.assembleCharacter('seed', { testSeed: seed });

  assert(sheet.characterSheetVersion === '1.0.0', 'characterSheetVersion missing or invalid');
  assert(sheet.header && sheet.header.id === 'seed-char-1', 'header.id missing or incorrect');
  assert(sheet.abilities && sheet.abilities.base && sheet.abilities.effective, 'abilities.base/effective missing');
  assert(Array.isArray(sheet.skills), 'skills missing or not array');
  assert(Array.isArray(sheet.savingThrows), 'savingThrows missing or not array');
  assert(sheet.derivedStats, 'derivedStats missing');
  assert(Array.isArray(sheet.inventory), 'inventory missing or not array');
  assert(Array.isArray(sheet.equipment), 'equipment missing or not array');
  assert(Array.isArray(sheet.capabilities), 'capabilities missing or not array');
  assert(typeof sheet.unresolvedChoices === 'number', 'unresolvedChoices missing or not a number');
  assert(sheet.unresolvedChoices === 0, 'unresolvedChoices must be 0');

  console.log('Sheet contract validation test: PASS');
}

main().catch(err => {
  console.error('Sheet contract validation test: FAIL', err);
  process.exit(1);
});
