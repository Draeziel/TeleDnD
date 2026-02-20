import fs from 'fs';
import path from 'path';
import { Prisma, PrismaClient } from '@prisma/client';

type CoreNode = {
  externalId: string;
  name: string;
  rulesVersion?: string;
};

type FeatureNode = CoreNode & {
  description?: string;
};

type ItemNode = CoreNode & {
  description?: string;
  slot?: string;
  weaponCategory?: string;
  attackAbility?: string;
  damageFormula?: string;
  proficiencyRequirements?: Record<string, unknown>;
  armorType?: string;
};

type ClassLevelProgressionNode = {
  classExternalId: string;
  level: number;
  featureExternalId: string;
};

type ActionNode = {
  externalId: string;
  name: string;
  featureExternalId?: string;
  payloadType: string;
  payload: Record<string, unknown>;
  trigger?: Record<string, unknown>;
  description?: string;
  rulesVersion?: string;
};

type SpellNode = {
  externalId: string;
  name: string;
  level?: number;
  school?: string;
  itemExternalId?: string;
  payloadType?: string;
  payload?: Record<string, unknown>;
  description?: string;
  rulesVersion?: string;
};

type ContentPack = {
  contentSource: {
    name: string;
    rulesVersion?: string;
  };
  classes?: CoreNode[];
  races?: CoreNode[];
  backgrounds?: CoreNode[];
  features?: FeatureNode[];
  items?: ItemNode[];
  classLevelProgressions?: ClassLevelProgressionNode[];
  actions?: ActionNode[];
  spells?: SpellNode[];
};

type ImportReport = {
  dryRun: boolean;
  filePath: string;
  contentSource: string;
  counts: Record<string, number>;
  warnings: string[];
};

const prisma = new PrismaClient();

function parseArgs() {
  const args = process.argv.slice(2);
  let filePath = path.resolve(process.cwd(), 'content', 'rules-pack.demo.json');
  let dryRun = true;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--file' && args[i + 1]) {
      filePath = path.resolve(process.cwd(), args[i + 1]);
      i++;
      continue;
    }

    if (arg === '--apply') {
      dryRun = false;
      continue;
    }

    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }
  }

  return { filePath, dryRun };
}

function ensureArray<T>(value: T[] | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function requireExternalId<T extends { externalId: string }>(nodes: T[], label: string) {
  for (const node of nodes) {
    if (!node.externalId || !node.externalId.trim()) {
      throw new Error(`Invalid ${label}: externalId is required`);
    }
  }
}

function loadPack(filePath: string): ContentPack {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Pack file not found: ${filePath}`);
  }

  const raw = fs.readFileSync(filePath, 'utf-8');
  const parsed = JSON.parse(raw) as ContentPack;

  if (!parsed.contentSource?.name) {
    throw new Error('Invalid pack: contentSource.name is required');
  }

  requireExternalId(ensureArray(parsed.classes), 'class node');
  requireExternalId(ensureArray(parsed.races), 'race node');
  requireExternalId(ensureArray(parsed.backgrounds), 'background node');
  requireExternalId(ensureArray(parsed.features), 'feature node');
  requireExternalId(ensureArray(parsed.items), 'item node');
  requireExternalId(ensureArray(parsed.actions), 'action node');
  requireExternalId(ensureArray(parsed.spells), 'spell node');

  return parsed;
}

function defaultRulesVersion(value: string | undefined): string {
  return value && value.trim() ? value : 'v1';
}

async function upsertCoreNode(
  tx: Prisma.TransactionClient,
  node: CoreNode,
  model: 'class' | 'race' | 'background',
  contentSourceId: string
): Promise<string> {
  const existingByRef = await (tx[model] as any).findUnique({ where: { sourceRef: node.externalId } });
  if (existingByRef) {
    const updated = await (tx[model] as any).update({
      where: { id: existingByRef.id },
      data: {
        name: node.name,
        rulesVersion: defaultRulesVersion(node.rulesVersion),
        contentSourceId,
      },
      select: { id: true },
    });
    return updated.id;
  }

  const existingByName = await (tx[model] as any).findUnique({ where: { name: node.name } });
  if (existingByName && existingByName.sourceRef && existingByName.sourceRef !== node.externalId) {
    throw new Error(`Importer guard: ${model} '${node.name}' already bound to sourceRef '${existingByName.sourceRef}', cannot change to '${node.externalId}'`);
  }

  if (existingByName) {
    const updated = await (tx[model] as any).update({
      where: { id: existingByName.id },
      data: {
        sourceRef: existingByName.sourceRef || node.externalId,
        rulesVersion: defaultRulesVersion(node.rulesVersion),
        contentSourceId,
      },
      select: { id: true },
    });
    return updated.id;
  }

  const created = await (tx[model] as any).create({
    data: {
      name: node.name,
      sourceRef: node.externalId,
      rulesVersion: defaultRulesVersion(node.rulesVersion),
      contentSourceId,
    },
    select: { id: true },
  });

  return created.id;
}

async function runImport(pack: ContentPack, dryRun: boolean, filePath: string): Promise<ImportReport> {
  const classes = ensureArray(pack.classes);
  const races = ensureArray(pack.races);
  const backgrounds = ensureArray(pack.backgrounds);
  const features = ensureArray(pack.features);
  const items = ensureArray(pack.items);
  const progressions = ensureArray(pack.classLevelProgressions);
  const actions = ensureArray(pack.actions);
  const spells = ensureArray(pack.spells);

  const counts: Record<string, number> = {
    classes: classes.length,
    races: races.length,
    backgrounds: backgrounds.length,
    features: features.length,
    items: items.length,
    classLevelProgressions: progressions.length,
    actions: actions.length,
    spells: spells.length,
  };

  const report: ImportReport = {
    dryRun,
    filePath,
    contentSource: pack.contentSource.name,
    counts,
    warnings: [],
  };

  if (dryRun) {
    return report;
  }

  await prisma.$transaction(async (tx) => {
    const contentSource = await tx.contentSource.upsert({
      where: { name: pack.contentSource.name },
      update: {},
      create: { name: pack.contentSource.name },
      select: { id: true },
    });

    const classIdByExternalId = new Map<string, string>();
    for (const node of classes) {
      const id = await upsertCoreNode(tx, node, 'class', contentSource.id);
      classIdByExternalId.set(node.externalId, id);
    }

    for (const node of races) {
      await upsertCoreNode(tx, node, 'race', contentSource.id);
    }

    for (const node of backgrounds) {
      await upsertCoreNode(tx, node, 'background', contentSource.id);
    }

    const featureIdByExternalId = new Map<string, string>();
    for (const node of features) {
      const existingByRef = await tx.feature.findFirst({ where: { sourceRef: node.externalId } });
      if (existingByRef) {
        const updated = await tx.feature.update({
          where: { id: existingByRef.id },
          data: {
            name: node.name,
            description: node.description,
            rulesVersion: defaultRulesVersion(node.rulesVersion),
            contentSourceId: contentSource.id,
          },
          select: { id: true },
        });
        featureIdByExternalId.set(node.externalId, updated.id);
        continue;
      }

      const existingByName = await tx.feature.findUnique({ where: { name: node.name } });
      if (existingByName && existingByName.sourceRef && existingByName.sourceRef !== node.externalId) {
        throw new Error(`Importer guard: feature '${node.name}' already bound to sourceRef '${existingByName.sourceRef}', cannot change to '${node.externalId}'`);
      }

      if (existingByName) {
        const updated = await tx.feature.update({
          where: { id: existingByName.id },
          data: {
            sourceRef: existingByName.sourceRef || node.externalId,
            description: node.description,
            rulesVersion: defaultRulesVersion(node.rulesVersion),
            contentSourceId: contentSource.id,
          },
          select: { id: true },
        });
        featureIdByExternalId.set(node.externalId, updated.id);
        continue;
      }

      const created = await tx.feature.create({
        data: {
          name: node.name,
          description: node.description,
          sourceRef: node.externalId,
          rulesVersion: defaultRulesVersion(node.rulesVersion),
          contentSourceId: contentSource.id,
        },
        select: { id: true },
      });
      featureIdByExternalId.set(node.externalId, created.id);
    }

    const itemIdByExternalId = new Map<string, string>();
    for (const node of items) {
      const existingByRef = await tx.item.findFirst({ where: { sourceRef: node.externalId } });
      if (existingByRef) {
        const updated = await tx.item.update({
          where: { id: existingByRef.id },
          data: {
            name: node.name,
            description: node.description,
            slot: node.slot,
            weaponCategory: node.weaponCategory,
            attackAbility: node.attackAbility,
            damageFormula: node.damageFormula,
            proficiencyRequirements: node.proficiencyRequirements as Prisma.InputJsonValue | undefined,
            armorType: node.armorType,
            rulesVersion: defaultRulesVersion(node.rulesVersion),
            contentSourceId: contentSource.id,
          },
          select: { id: true },
        });
        itemIdByExternalId.set(node.externalId, updated.id);
        continue;
      }

      const existingByName = await tx.item.findUnique({ where: { name: node.name } });
      if (existingByName && existingByName.sourceRef && existingByName.sourceRef !== node.externalId) {
        throw new Error(`Importer guard: item '${node.name}' already bound to sourceRef '${existingByName.sourceRef}', cannot change to '${node.externalId}'`);
      }

      if (existingByName) {
        const updated = await tx.item.update({
          where: { id: existingByName.id },
          data: {
            sourceRef: existingByName.sourceRef || node.externalId,
            description: node.description,
            slot: node.slot,
            weaponCategory: node.weaponCategory,
            attackAbility: node.attackAbility,
            damageFormula: node.damageFormula,
            proficiencyRequirements: node.proficiencyRequirements as Prisma.InputJsonValue | undefined,
            armorType: node.armorType,
            rulesVersion: defaultRulesVersion(node.rulesVersion),
            contentSourceId: contentSource.id,
          },
          select: { id: true },
        });
        itemIdByExternalId.set(node.externalId, updated.id);
        continue;
      }

      const created = await tx.item.create({
        data: {
          name: node.name,
          description: node.description,
          slot: node.slot,
          weaponCategory: node.weaponCategory,
          attackAbility: node.attackAbility,
          damageFormula: node.damageFormula,
          proficiencyRequirements: node.proficiencyRequirements as Prisma.InputJsonValue | undefined,
          armorType: node.armorType,
          sourceRef: node.externalId,
          rulesVersion: defaultRulesVersion(node.rulesVersion),
          contentSourceId: contentSource.id,
        },
        select: { id: true },
      });
      itemIdByExternalId.set(node.externalId, created.id);
    }

    for (const progression of progressions) {
      const classId = classIdByExternalId.get(progression.classExternalId);
      const featureId = featureIdByExternalId.get(progression.featureExternalId);

      if (!classId || !featureId) {
        report.warnings.push(`Skipping progression class=${progression.classExternalId} feature=${progression.featureExternalId}: unresolved external ID`);
        continue;
      }

      await tx.classLevelProgression.upsert({
        where: {
          classId_level_featureId: {
            classId,
            level: progression.level,
            featureId,
          },
        },
        update: {},
        create: {
          classId,
          level: progression.level,
          featureId,
        },
      });
    }

    for (const action of actions) {
      const featureId = action.featureExternalId ? featureIdByExternalId.get(action.featureExternalId) : null;
      if (action.featureExternalId && !featureId) {
        report.warnings.push(`Skipping action '${action.externalId}': unresolved feature external ID '${action.featureExternalId}'`);
        continue;
      }

      const existingByRef = await tx.action.findFirst({ where: { sourceRef: action.externalId } });
      if (existingByRef) {
        await tx.action.update({
          where: { id: existingByRef.id },
          data: {
            name: action.name,
            description: action.description,
            featureId,
            payloadType: action.payloadType,
            payloadJson: action.payload as Prisma.InputJsonValue,
            triggerJson: action.trigger as Prisma.InputJsonValue | undefined,
            rulesVersion: defaultRulesVersion(action.rulesVersion),
            contentSourceId: contentSource.id,
          },
        });
        continue;
      }

      await tx.action.create({
        data: {
          name: action.name,
          description: action.description,
          featureId,
          payloadType: action.payloadType,
          payloadJson: action.payload as Prisma.InputJsonValue,
          triggerJson: action.trigger as Prisma.InputJsonValue | undefined,
          sourceRef: action.externalId,
          rulesVersion: defaultRulesVersion(action.rulesVersion),
          contentSourceId: contentSource.id,
        },
      });
    }

    for (const spell of spells) {
      const itemId = spell.itemExternalId ? itemIdByExternalId.get(spell.itemExternalId) : null;
      if (spell.itemExternalId && !itemId) {
        report.warnings.push(`Skipping spell '${spell.externalId}': unresolved item external ID '${spell.itemExternalId}'`);
        continue;
      }

      const existingByRef = await tx.spell.findFirst({ where: { sourceRef: spell.externalId } });
      if (existingByRef) {
        await tx.spell.update({
          where: { id: existingByRef.id },
          data: {
            name: spell.name,
            description: spell.description,
            level: spell.level,
            school: spell.school,
            itemId,
            payloadType: spell.payloadType || 'CUSTOM',
            payloadJson: spell.payload as Prisma.InputJsonValue | undefined,
            rulesVersion: defaultRulesVersion(spell.rulesVersion),
            contentSourceId: contentSource.id,
          },
        });
        continue;
      }

      await tx.spell.create({
        data: {
          name: spell.name,
          description: spell.description,
          level: spell.level,
          school: spell.school,
          itemId,
          payloadType: spell.payloadType || 'CUSTOM',
          payloadJson: spell.payload as Prisma.InputJsonValue | undefined,
          sourceRef: spell.externalId,
          rulesVersion: defaultRulesVersion(spell.rulesVersion),
          contentSourceId: contentSource.id,
        },
      });
    }
  });

  return report;
}

async function main() {
  const { filePath, dryRun } = parseArgs();
  const pack = loadPack(filePath);

  const report = await runImport(pack, dryRun, filePath);
  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
