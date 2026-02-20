import assert from 'assert';
import CharacterAssemblerService from '../../src/services/characterAssemblerService';

async function run() {
  const svc = new CharacterAssemblerService();

  const seed = {
    characterSheetVersion: '1.0.0',
    header: { id: 'char.test.1', name: 'Test Hero', level: 1, class: { id: 'class.barbarian', name: 'Barbarian' } },
    abilities: { base: { str: 16, dex: 12, con: 14, int: 8, wis: 10, cha: 10 }, effective: { str: 16, dex: 12, con: 14, int: 8, wis: 10, cha: 10 } },
    skills: [{ id: 'skill.athletics', name: 'Athletics', proficient: true, bonus: 5 }],
    savingThrows: [{ ability: 'str', proficient: true, bonus: 5 }],
    derivedStats: { initiative: 1, proficiencyBonus: 2, armorClass: 15, passivePerception: 10 },
    inventory: [],
    equipment: [],
    capabilities: [],
    activeEffects: [],
    unresolvedChoices: 0,
  };

  const sheet = await svc.assembleCharacter('char.test.1', { testSeed: seed });

  assert.ok(sheet, 'sheet must be present');
  assert.strictEqual(sheet.characterSheetVersion, '1.0.0');
  assert.ok(sheet.header && sheet.header.id === 'char.test.1');
  assert.ok(sheet.abilities && sheet.abilities.base && sheet.abilities.effective);
  assert.ok(Array.isArray(sheet.skills));
  assert.strictEqual(sheet.unresolvedChoices, 0);

  console.log('CharacterAssemblerService unit test: PASS');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
