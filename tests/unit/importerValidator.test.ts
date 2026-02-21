import { buildContentIndexSync } from '../../src/resolver/contentLoader';
import { validateContentIndex } from '../../src/importer/validator';

function run() {
  const index = buildContentIndexSync();
  const res = validateContentIndex(index);

  console.log('validation result:', { valid: res.valid, missingCount: res.missingReferences.length, cycles: res.cycles.length });

  // For current sample content we expect missing feature references (barbarian/bard grant features not present)
  if (res.cycles.length > 0) {
    console.error('importerValidator test: FAIL - unexpected cycles found', res.cycles);
    process.exit(1);
  }

  if (res.missingReferences.length === 0) {
    // pass: if content is complete
    console.log('importerValidator test: PASS (no missing refs)');
    return;
  }

  // We expect missing refs for the minimal sample; ensure they are reported
  const hasUnarmored = res.missingReferences.includes('feature:unarmored_defense');
  const hasSpellcasting = res.missingReferences.includes('feature:spellcasting');

  if (hasUnarmored && hasSpellcasting) {
    console.log('importerValidator test: PASS (missing refs detected as expected)');
    return;
  }

  console.error('importerValidator test: FAIL - unexpected missing refs', res.missingReferences);
  process.exit(1);
}

try {
  run();
} catch (err) {
  console.error('importerValidator test: FAIL', err);
  process.exit(1);
}
