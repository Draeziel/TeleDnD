import assert from 'assert';
import { buildContentIndexSync } from '../../src/resolver/contentLoader';

(() => {
  const index = buildContentIndexSync();
  // basic expectations from the content vertical slice
  assert(index.has('class:barbarian:1'), 'index must include class:barbarian:1');
  assert(index.has('class:bard:1'), 'index must include class:bard:1');
  assert(index.has('feature:unarmored_defense'), 'index must include feature:unarmored_defense');
  assert(index.has('feature:spellcasting'), 'index must include feature:spellcasting');

  console.log('contentIndex test: PASS');
})();
