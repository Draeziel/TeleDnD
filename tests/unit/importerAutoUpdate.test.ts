import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { createPlaceholdersForPack } from '../../src/importer/autoUpdateHelper';

(async () => {
  const file = path.resolve(__dirname, '../fixtures/missing-ref-pack.json');
  const raw = fs.readFileSync(file, 'utf8');
  const pack = JSON.parse(raw);

  const missing = ['feature:missing_feature'];
  const { pack: updated, createdPlaceholders } = createPlaceholdersForPack(pack, missing as string[] as string[]);

  assert(Array.isArray(createdPlaceholders), 'createdPlaceholders must be array');
  assert(createdPlaceholders.includes('feature:missing_feature'), 'placeholder for missing_feature should be created');
  assert((updated.features || []).some((f: any) => f.externalId === 'feature:missing_feature'));

  console.log('importerAutoUpdate test: PASS');
  process.exit(0);
})();
