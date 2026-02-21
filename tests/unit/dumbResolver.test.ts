import { buildContentIndexSync, loadNodeSyncFromIndex } from '../../src/resolver/contentLoader';
import { traverseResolverSync } from '../../src/resolver/dumbResolver';

function run() {
  const index = buildContentIndexSync();
  const start = ['class:barbarian:1', 'class:bard:1'];

  const res = traverseResolverSync(start, (id) => loadNodeSyncFromIndex(index, id));

  const capIds = new Set((res.capabilities || []).map((c: any) => c.id));

  if (!capIds.has('cap:rage:1')) throw new Error('missing cap:rage:1');
  if (!capIds.has('cap:inspire:1')) throw new Error('missing cap:inspire:1');
  if (!capIds.has('cap:unarmored_defense:1')) throw new Error('missing cap:unarmored_defense:1');
  if (!capIds.has('cap:spellcasting:1')) throw new Error('missing cap:spellcasting:1');

  console.log('dumbResolver test: PASS');
}

try {
  run();
} catch (err) {
  console.error('dumbResolver test: FAIL', err);
  process.exit(1);
}
