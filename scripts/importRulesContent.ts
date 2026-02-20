import fs from 'fs';
import path from 'path';
import { Prisma, PrismaClient } from '@prisma/client';

type ImportIssue = {
  severity: 'error' | 'warning';
  path: string;
  rule: string;
  reason: string;
};

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
  issues: ImportIssue[];
};

class ImportIssueError extends Error {
  issue: ImportIssue;

  constructor(issue: ImportIssue) {
    super(issue.reason);
    this.issue = issue;
  }
}

class ImportReportError extends Error {
  report: ImportReport;

  constructor(report: ImportReport, message: string) {
    super(message);
    this.report = report;
  }
}

const prisma = new PrismaClient();

function parseArgs() {
  const args = process.argv.slice(2);
  let filePath = path.resolve(process.cwd(), 'content', 'rules-pack.demo.json');
  let dryRun = true;
  let reportFile: string | undefined;

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

    if (arg === '--report-file' && args[i + 1]) {
      reportFile = path.resolve(process.cwd(), args[i + 1]);
      i++;
      continue;
    }
  }

  return { filePath, dryRun, reportFile };
}

function ensureArray<T>(value: T[] | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function buildCounts(pack: ContentPack): Record<string, number> {
  return {
    classes: ensureArray(pack.classes).length,
    races: ensureArray(pack.races).length,
    backgrounds: ensureArray(pack.backgrounds).length,
    features: ensureArray(pack.features).length,
    items: ensureArray(pack.items).length,
    classLevelProgressions: ensureArray(pack.classLevelProgressions).length,
    actions: ensureArray(pack.actions).length,
    spells: ensureArray(pack.spells).length,
  };
}

function validateExternalIds<T extends { externalId: string }>(
  nodes: T[],
  listPath: string,
  issues: ImportIssue[]
) {
  nodes.forEach((node, index) => {
    if (!node.externalId || !node.externalId.trim()) {
      issues.push({
        severity: 'error',
        path: `${listPath}[${index}].externalId`,
        rule: 'required_external_id',
        reason: 'externalId is required',
      });
    }
  });
}

function loadPack(filePath: string): ContentPack {
  if (!fs.existsSync(filePath)) {
    throw new ImportIssueError({
      severity: 'error',
      path: '$',
      rule: 'file_exists',
      reason: `Pack file not found: ${filePath}`,
    });
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as ContentPack;
  } catch (error) {
    throw new ImportIssueError({
      severity: 'error',
      path: '$',
      rule: 'json_parse',
      reason: `Failed to parse pack JSON: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

function validatePack(pack: ContentPack): ImportIssue[] {
  const issues: ImportIssue[] = [];

  if (!pack.contentSource?.name) {
    issues.push({
      severity: 'error',
      path: 'contentSource.name',
      rule: 'required_field',
      reason: 'contentSource.name is required',
    });
  }

  validateExternalIds(ensureArray(pack.classes), 'classes', issues);
  validateExternalIds(ensureArray(pack.races), 'races', issues);
  validateExternalIds(ensureArray(pack.backgrounds), 'backgrounds', issues);
  validateExternalIds(ensureArray(pack.features), 'features', issues);
  validateExternalIds(ensureArray(pack.items), 'items', issues);
  validateExternalIds(ensureArray(pack.actions), 'actions', issues);
  validateExternalIds(ensureArray(pack.spells), 'spells', issues);

  ensureArray(pack.classLevelProgressions).forEach((node, index) => {
    if (!node.classExternalId?.trim()) {
      issues.push({
        severity: 'error',
        path: `classLevelProgressions[${index}].classExternalId`,
        rule: 'required_relation_ref',
        reason: 'classExternalId is required',
      });
    }

    if (!node.featureExternalId?.trim()) {
      issues.push({
        severity: 'error',
        path: `classLevelProgressions[${index}].featureExternalId`,
        rule: 'required_relation_ref',
        reason: 'featureExternalId is required',
      });
    }
  });

  return issues;
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
    throw new ImportIssueError({
      severity: 'error',
      path: `${model}.name=${node.name}`,
      rule: 'immutable_external_id',
      reason: `${model} '${node.name}' already bound to sourceRef '${existingByName.sourceRef}', cannot change to '${node.externalId}'`,
    });
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

async function runImport(pack: ContentPack, dryRun: boolean, filePath: string, initialIssues: ImportIssue[]): Promise<ImportReport> {
  const classes = ensureArray(pack.classes);
  const races = ensureArray(pack.races);
  const backgrounds = ensureArray(pack.backgrounds);
  const features = ensureArray(pack.features);
  const items = ensureArray(pack.items);
  const progressions = ensureArray(pack.classLevelProgressions);
  const actions = ensureArray(pack.actions);
  const spells = ensureArray(pack.spells);

  const counts = buildCounts(pack);

  const report: ImportReport = {
    dryRun,
    filePath,
    contentSource: pack.contentSource?.name || '<missing>',
    counts,
    issues: [...initialIssues],
  };

  if (dryRun || report.issues.some(issue => issue.severity === 'error')) {
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
        throw new ImportIssueError({
          severity: 'error',
          path: `features.externalId=${node.externalId}`,
          rule: 'immutable_external_id',
          reason: `feature '${node.name}' already bound to sourceRef '${existingByName.sourceRef}', cannot change to '${node.externalId}'`,
        });
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
        throw new ImportIssueError({
          severity: 'error',
          path: `items.externalId=${node.externalId}`,
          rule: 'immutable_external_id',
          reason: `item '${node.name}' already bound to sourceRef '${existingByName.sourceRef}', cannot change to '${node.externalId}'`,
        });
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
        report.issues.push({
          severity: 'warning',
          path: `classLevelProgressions[classExternalId=${progression.classExternalId},featureExternalId=${progression.featureExternalId}]`,
          rule: 'unresolved_reference',
          reason: 'Skipping progression due to unresolved external ID',
        });
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
        report.issues.push({
          severity: 'warning',
          path: `actions.externalId=${action.externalId}`,
          rule: 'unresolved_reference',
          reason: `Skipping action due to unresolved feature external ID '${action.featureExternalId}'`,
        });
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
        report.issues.push({
          severity: 'warning',
          path: `spells.externalId=${spell.externalId}`,
          rule: 'unresolved_reference',
          reason: `Skipping spell due to unresolved item external ID '${spell.itemExternalId}'`,
        });
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
  const { filePath, dryRun, reportFile } = parseArgs();
  const pack = loadPack(filePath);
  const validationIssues = validatePack(pack);

  const report = await runImport(pack, dryRun, filePath, validationIssues);

  if (reportFile) {
    fs.mkdirSync(path.dirname(reportFile), { recursive: true });
    fs.writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`, 'utf-8');
  }

  console.log(JSON.stringify(report, null, 2));

  if (report.issues.some(issue => issue.severity === 'error')) {
    throw new ImportReportError(report, 'Import validation failed');
  }
}

main()
  .catch((error) => {
    if (error instanceof ImportIssueError) {
      const report: ImportReport = {
        dryRun: true,
        filePath: '<unknown>',
        contentSource: '<unknown>',
        counts: {
          classes: 0,
          races: 0,
          backgrounds: 0,
          features: 0,
          items: 0,
          classLevelProgressions: 0,
          actions: 0,
          spells: 0,
        },
        issues: [error.issue],
      };

      console.error(JSON.stringify(report, null, 2));
      process.exit(1);
    }

    if (error instanceof ImportReportError) {
      process.exit(1);
    }

    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
