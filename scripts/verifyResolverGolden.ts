import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { CapabilityResolverService } from '../src/services/capabilityResolverService';
import type { ResolveCapabilitiesDto, CapabilityBaseDto } from '../src/types';

type GoldenCase = {
  slug: string;
  className: string;
  raceName: string;
  backgroundName: string;
  level: number;
  characterName: string;
};

type StableCapability = {
  type: CapabilityBaseDto['type'];
  sourceType: CapabilityBaseDto['sourceType'];
  sourceRef: string;
  scope: CapabilityBaseDto['scope'];
  timing: CapabilityBaseDto['timing'];
  rulesVersion: string;
  payloadType: CapabilityBaseDto['payloadType'];
  payload: Record<string, unknown>;
  trigger?: CapabilityBaseDto['trigger'];
  executionIntent?: CapabilityBaseDto['executionIntent'];
  lifecycleState: CapabilityBaseDto['lifecycleState'];
};

type StableResolverSnapshot = {
  actions: StableCapability[];
  passiveFeatures: StableCapability[];
  modifiers: StableCapability[];
  choicesRemaining: StableCapability[];
  metadata: {
    rulesVersion: string;
    resolverSchemaVersion: string;
    computedAt: string;
    sourceGraphDigest: string;
  };
};

const TELEGRAM_USER_ID = 'golden-resolver-user';

const CASES: GoldenCase[] = [
  {
    slug: 'barbarian-level1',
    className: 'Barbarian',
    raceName: 'Human',
    backgroundName: 'Soldier',
    level: 1,
    characterName: 'Golden Barbarian L1',
  },
  {
    slug: 'bard-level1',
    className: 'Bard',
    raceName: 'Human',
    backgroundName: 'Soldier',
    level: 1,
    characterName: 'Golden Bard L1',
  },
];

const prisma = new PrismaClient();

function stableStringify(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function requireEntityId(modelName: string, value: { id: string } | null): Promise<string> {
  if (!value) {
    throw new Error(`Missing required seed entity: ${modelName}`);
  }

  return value.id;
}

async function ensureCharacter(caseConfig: GoldenCase): Promise<string> {
  const user = await prisma.user.upsert({
    where: { telegramId: TELEGRAM_USER_ID },
    update: {},
    create: { telegramId: TELEGRAM_USER_ID },
    select: { id: true },
  });

  const classId = await requireEntityId(
    `class:${caseConfig.className}`,
    await prisma.class.findUnique({ where: { name: caseConfig.className }, select: { id: true } })
  );

  const raceId = await requireEntityId(
    `race:${caseConfig.raceName}`,
    await prisma.race.findUnique({ where: { name: caseConfig.raceName }, select: { id: true } })
  );

  const backgroundId = await requireEntityId(
    `background:${caseConfig.backgroundName}`,
    await prisma.background.findUnique({ where: { name: caseConfig.backgroundName }, select: { id: true } })
  );

  const existing = await prisma.character.findFirst({
    where: {
      ownerUserId: user.id,
      name: caseConfig.characterName,
    },
    select: { id: true },
  });

  if (existing) {
    const updated = await prisma.character.update({
      where: { id: existing.id },
      data: {
        classId,
        raceId,
        backgroundId,
        level: caseConfig.level,
      },
      select: { id: true },
    });

    return updated.id;
  }

  const created = await prisma.character.create({
    data: {
      name: caseConfig.characterName,
      ownerUserId: user.id,
      classId,
      raceId,
      backgroundId,
      level: caseConfig.level,
    },
    select: { id: true },
  });

  return created.id;
}

async function loadNameMaps(snapshot: ResolveCapabilitiesDto): Promise<Record<string, Record<string, string>>> {
  const grouped = new Map<CapabilityBaseDto['sourceType'], Set<string>>();
  const allCapabilities = [
    ...snapshot.actions,
    ...snapshot.passiveFeatures,
    ...snapshot.modifiers,
    ...snapshot.choicesRemaining,
  ];

  for (const capability of allCapabilities) {
    if (!grouped.has(capability.sourceType)) {
      grouped.set(capability.sourceType, new Set<string>());
    }

    grouped.get(capability.sourceType)!.add(capability.sourceId);
  }

  const result: Record<string, Record<string, string>> = {
    class: {},
    race: {},
    feature: {},
    item: {},
    spell: {},
    system: {},
  };

  const classIds = Array.from(grouped.get('class') || []);
  if (classIds.length > 0) {
    const rows = await prisma.class.findMany({ where: { id: { in: classIds } }, select: { id: true, name: true } });
    rows.forEach((row) => {
      result.class[row.id] = `class:${row.name}`;
    });
  }

  const raceIds = Array.from(grouped.get('race') || []);
  if (raceIds.length > 0) {
    const rows = await prisma.race.findMany({ where: { id: { in: raceIds } }, select: { id: true, name: true } });
    rows.forEach((row) => {
      result.race[row.id] = `race:${row.name}`;
    });
  }

  const featureIds = Array.from(grouped.get('feature') || []);
  if (featureIds.length > 0) {
    const rows = await prisma.feature.findMany({ where: { id: { in: featureIds } }, select: { id: true, name: true } });
    rows.forEach((row) => {
      result.feature[row.id] = `feature:${row.name}`;
    });
  }

  const itemIds = Array.from(grouped.get('item') || []);
  if (itemIds.length > 0) {
    const rows = await prisma.item.findMany({ where: { id: { in: itemIds } }, select: { id: true, name: true } });
    rows.forEach((row) => {
      result.item[row.id] = `item:${row.name}`;
    });
  }

  return result;
}

function toStableCapability(
  capability: CapabilityBaseDto,
  nameMaps: Record<string, Record<string, string>>
): StableCapability {
  const sourceRef = nameMaps[capability.sourceType]?.[capability.sourceId] || `${capability.sourceType}:${capability.sourceId}`;

  return {
    type: capability.type,
    sourceType: capability.sourceType,
    sourceRef,
    scope: capability.scope,
    timing: capability.timing,
    rulesVersion: capability.rulesVersion,
    payloadType: capability.payloadType,
    payload: capability.payload,
    trigger: capability.trigger,
    executionIntent: capability.executionIntent,
    lifecycleState: capability.lifecycleState,
  };
}

async function toStableSnapshot(snapshot: ResolveCapabilitiesDto): Promise<StableResolverSnapshot> {
  const nameMaps = await loadNameMaps(snapshot);

  return {
    actions: snapshot.actions.map((capability) => toStableCapability(capability, nameMaps)),
    passiveFeatures: snapshot.passiveFeatures.map((capability) => toStableCapability(capability, nameMaps)),
    modifiers: snapshot.modifiers.map((capability) => toStableCapability(capability, nameMaps)),
    choicesRemaining: snapshot.choicesRemaining.map((capability) => toStableCapability(capability, nameMaps)),
    metadata: {
      rulesVersion: snapshot.metadata.rulesVersion,
      resolverSchemaVersion: snapshot.metadata.resolverSchemaVersion,
      computedAt: '<computedAt>',
      sourceGraphDigest: '<sourceGraphDigest>',
    },
  };
}

async function run(): Promise<void> {
  const shouldUpdate = process.argv.includes('--update');
  const repoRoot = path.resolve(__dirname, '..');
  const fixturesDir = path.join(repoRoot, 'tests', 'golden', 'resolver');

  fs.mkdirSync(fixturesDir, { recursive: true });

  const resolver = new CapabilityResolverService(prisma);
  const mismatches: string[] = [];

  for (const caseConfig of CASES) {
    const characterId = await ensureCharacter(caseConfig);
    const resolved = await resolver.resolveCharacterCapabilities(characterId, TELEGRAM_USER_ID);
    const stableSnapshot = await toStableSnapshot(resolved);

    const fixturePath = path.join(fixturesDir, `${caseConfig.slug}.json`);
    const actualText = stableStringify(stableSnapshot);

    if (shouldUpdate) {
      fs.writeFileSync(fixturePath, actualText, 'utf-8');
      console.log(`Updated fixture: ${path.relative(repoRoot, fixturePath)}`);
      continue;
    }

    if (!fs.existsSync(fixturePath)) {
      mismatches.push(`${caseConfig.slug}: missing fixture`);
      fs.writeFileSync(`${fixturePath}.actual.json`, actualText, 'utf-8');
      continue;
    }

    const expectedText = fs.readFileSync(fixturePath, 'utf-8');
    if (expectedText !== actualText) {
      mismatches.push(`${caseConfig.slug}: snapshot mismatch`);
      fs.writeFileSync(`${fixturePath}.actual.json`, actualText, 'utf-8');
    }
  }

  if (mismatches.length > 0) {
    throw new Error(`Resolver golden verification failed:\n- ${mismatches.join('\n- ')}`);
  }

  if (!shouldUpdate) {
    console.log('Resolver golden verification passed.');
  }
}

run()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
