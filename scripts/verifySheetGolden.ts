import fs from 'fs';
import path from 'path';
import { CharacterAssemblerService } from '../src/services/characterAssemblerService';

function deepEqual(a: any, b: any): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

async function main() {
  const dir = path.resolve(__dirname, '../tests/golden/character_sheet');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  const assembler = new CharacterAssemblerService();

  let failed = 0;
  for (const file of files) {
    const full = path.join(dir, file);
    const golden = JSON.parse(fs.readFileSync(full, 'utf8'));

    // Run assembler in seed-mode to validate assembly produces same shape
    const assembled = await assembler.assembleCharacter('golden-seed', { testSeed: golden });

    if (!deepEqual(assembled, golden)) {
      console.error(`Golden mismatch for ${file}`);
      console.error('Expected:', JSON.stringify(golden, null, 2));
      console.error('Actual:  ', JSON.stringify(assembled, null, 2));
      failed += 1;
    } else {
      console.log(`${file}: OK`);
    }
  }

  if (failed > 0) {
    console.error(`Golden verification failed: ${failed} file(s)`);
    process.exit(2);
  }

  console.log('Sheet golden verification passed.');
}

main().catch(err => {
  console.error('Error during sheet golden verification', err);
  process.exit(1);
});
