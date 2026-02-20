import fs from 'fs';
import path from 'path';
import { Prisma, PrismaClient } from '@prisma/client';

type ImportIssue = {
  severity: 'error' | 'warning';
  path: string;
  rule: string;
  reason: string;
};

const ALLOWED_ACTION_PAYLOAD_TYPES = new Set([
  'ACTION_ATTACK',
  'PASSIVE_TRAIT',
  'MODIFIER_ABILITY_SCORE',
  'CHOICE_SELECTION',
  'RUNTIME_EFFECT',
  'CUSTOM',
]);

const ALLOWED_TRIGGER_PHASES = new Set([
  'on_apply',
  'turn_start',
  'turn_end',
  'on_hit',
  'on_damage',
  'on_save',
  'manual',
]);

const ALLOWED_TRIGGER_TARGETING = new Set(['self', 'ally', 'enemy', 'area', 'explicit']);
const ALLOWED_TRIGGER_STACK_POLICY = new Set(['refresh', 'stack', 'ignore', 'replace']);

type CoreNode = {
  externalId: string;
  name: string;
  rulesVersion?: string;
};

type FeatureNode = CoreNode & {
  description?: string;
};

type ChoiceOptionNode =
  | string
  | {
      id: string;
      name?: string;
      description?: string;
    };

type ChoiceNode = {
  externalId: string;
  sourceType: 'class' | 'race' | 'background' | 'feature' | 'item' | 'spell';
  sourceExternalId: string;
  chooseCount: number;
  options: ChoiceOptionNode[];
  rulesVersion?: string;
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

type DependencyRelationType = 'depends_on' | 'requires' | 'excludes';

type DependencyNode = {
  sourceRef: string;
  sourceType?: string;
  targetRef: string;
  targetType?: string;
  relationType: DependencyRelationType;
  rulesVersion?: string;
};

type ContentPack = {
  schemaVersion: string;
  contentSource: {
    name: string;
    rulesVersion?: string;
  };
  classes?: CoreNode[];
  races?: CoreNode[];
  backgrounds?: CoreNode[];
  features?: FeatureNode[];
  choices?: ChoiceNode[];
  items?: ItemNode[];
  classLevelProgressions?: ClassLevelProgressionNode[];
  actions?: ActionNode[];
  spells?: SpellNode[];
  dependencies?: DependencyNode[];
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
const SUPPORTED_PACK_SCHEMA_VERSION = '1.0.0';
const ALLOWED_PACK_TOP_LEVEL_KEYS = [
  'schemaVersion',
  'contentSource',
  'classes',
  'races',
  'backgrounds',
  'features',
  'choices',
  'items',
  'classLevelProgressions',
  'actions',
  'spells',
  'dependencies',
] as const;

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
    choices: ensureArray(pack.choices).length,
    items: ensureArray(pack.items).length,
    classLevelProgressions: ensureArray(pack.classLevelProgressions).length,
    actions: ensureArray(pack.actions).length,
    spells: ensureArray(pack.spells).length,
    dependencies: ensureArray(pack.dependencies).length,
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
  const allowedDependencyRelations: DependencyRelationType[] = ['depends_on', 'requires', 'excludes'];

  if (!pack.schemaVersion?.trim()) {
    issues.push({
      severity: 'error',
      path: 'schemaVersion',
      rule: 'required_field',
      reason: 'schemaVersion is required',
    });
  } else if (pack.schemaVersion !== SUPPORTED_PACK_SCHEMA_VERSION) {
    issues.push({
      severity: 'error',
      path: 'schemaVersion',
      rule: 'unsupported_schema_version',
      reason: `Unsupported schemaVersion '${pack.schemaVersion}'. Expected '${SUPPORTED_PACK_SCHEMA_VERSION}'`,
    });
  }

  const allowedKeySet = new Set<string>(ALLOWED_PACK_TOP_LEVEL_KEYS as readonly string[]);
  Object.keys(pack).forEach((key) => {
    if (!allowedKeySet.has(key)) {
      issues.push({
        severity: 'error',
        path: key,
        rule: 'unknown_top_level_key',
        reason: `Unknown top-level key '${key}'. Allowed keys: ${ALLOWED_PACK_TOP_LEVEL_KEYS.join(', ')}`,
      });
    }
  });

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
  validateExternalIds(ensureArray(pack.choices), 'choices', issues);
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

  ensureArray(pack.choices).forEach((node, index) => {
    if (!node.sourceExternalId?.trim()) {
      issues.push({
        severity: 'error',
        path: `choices[${index}].sourceExternalId`,
        rule: 'required_relation_ref',
        reason: 'sourceExternalId is required',
      });
    }

    if (!Number.isInteger(node.chooseCount) || node.chooseCount <= 0) {
      issues.push({
        severity: 'error',
        path: `choices[${index}].chooseCount`,
        rule: 'choose_count_positive_int',
        reason: 'chooseCount must be a positive integer',
      });
    }

    if (!Array.isArray(node.options) || node.options.length === 0) {
      issues.push({
        severity: 'error',
        path: `choices[${index}].options`,
        rule: 'choice_options_non_empty',
        reason: 'options must be a non-empty array',
      });
      return;
    }

    if (node.chooseCount > node.options.length) {
      issues.push({
        severity: 'error',
        path: `choices[${index}].chooseCount`,
        rule: 'choose_count_le_options',
        reason: `chooseCount (${node.chooseCount}) cannot exceed options length (${node.options.length})`,
      });
    }

    const optionIds = node.options
      .map((option) => (typeof option === 'string' ? option : option?.id))
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

    if (optionIds.length !== node.options.length) {
      issues.push({
        severity: 'error',
        path: `choices[${index}].options`,
        rule: 'choice_option_id_required',
        reason: 'each option must provide a non-empty id (string option or object.id)',
      });
      return;
    }

    if (new Set(optionIds).size !== optionIds.length) {
      issues.push({
        severity: 'error',
        path: `choices[${index}].options`,
        rule: 'choice_option_id_unique',
        reason: 'choice option ids must be unique within a choice node',
      });
    }
  });

  ensureArray(pack.dependencies).forEach((node, index) => {
    if (!node.sourceRef?.trim()) {
      issues.push({
        severity: 'error',
        path: `dependencies[${index}].sourceRef`,
        rule: 'required_relation_ref',
        reason: 'sourceRef is required',
      });
    }

    if (!node.targetRef?.trim()) {
      issues.push({
        severity: 'error',
        path: `dependencies[${index}].targetRef`,
        rule: 'required_relation_ref',
        reason: 'targetRef is required',
      });
    }

    if (!allowedDependencyRelations.includes(node.relationType)) {
      issues.push({
        severity: 'error',
        path: `dependencies[${index}].relationType`,
        rule: 'allowed_dependency_relation',
        reason: `Unsupported relationType '${node.relationType}'. Allowed: ${allowedDependencyRelations.join(', ')}`,
      });
    }
  });

  ensureArray(pack.actions).forEach((node, index) => {
    if (!node.name?.trim()) {
      issues.push({
        severity: 'error',
        path: `actions[${index}].name`,
        rule: 'required_field',
        reason: 'action name is required',
      });
    }

    if (!node.payloadType?.trim()) {
      issues.push({
        severity: 'error',
        path: `actions[${index}].payloadType`,
        rule: 'required_field',
        reason: 'action payloadType is required',
      });
    } else if (!ALLOWED_ACTION_PAYLOAD_TYPES.has(node.payloadType)) {
      issues.push({
        severity: 'error',
        path: `actions[${index}].payloadType`,
        rule: 'allowed_payload_type',
        reason: `Unsupported action payloadType '${node.payloadType}'`,
      });
    }

    if (!node.payload || typeof node.payload !== 'object' || Array.isArray(node.payload)) {
      issues.push({
        severity: 'error',
        path: `actions[${index}].payload`,
        rule: 'payload_object_required',
        reason: 'action payload must be an object',
      });
    }

    if (node.featureExternalId !== undefined && !node.featureExternalId.trim()) {
      issues.push({
        severity: 'error',
        path: `actions[${index}].featureExternalId`,
        rule: 'non_empty_string',
        reason: 'featureExternalId must be a non-empty string when provided',
      });
    }

    if (node.trigger !== undefined) {
      if (!node.trigger || typeof node.trigger !== 'object' || Array.isArray(node.trigger)) {
        issues.push({
          severity: 'error',
          path: `actions[${index}].trigger`,
          rule: 'trigger_object_required',
          reason: 'trigger must be an object when provided',
        });
        return;
      }

      const triggerPhase = (node.trigger as Record<string, unknown>).phase;
      const triggerTargeting = (node.trigger as Record<string, unknown>).targeting;
      const triggerStackPolicy = (node.trigger as Record<string, unknown>).stackPolicy;
      const triggerCooldown = (node.trigger as Record<string, unknown>).cooldown;

      if (typeof triggerPhase !== 'string' || !ALLOWED_TRIGGER_PHASES.has(triggerPhase)) {
        issues.push({
          severity: 'error',
          path: `actions[${index}].trigger.phase`,
          rule: 'allowed_trigger_phase',
          reason: `Unsupported trigger.phase '${String(triggerPhase)}'`,
        });
      }

      if (typeof triggerTargeting !== 'string' || !ALLOWED_TRIGGER_TARGETING.has(triggerTargeting)) {
        issues.push({
          severity: 'error',
          path: `actions[${index}].trigger.targeting`,
          rule: 'allowed_trigger_targeting',
          reason: `Unsupported trigger.targeting '${String(triggerTargeting)}'`,
        });
      }

      if (typeof triggerStackPolicy !== 'string' || !ALLOWED_TRIGGER_STACK_POLICY.has(triggerStackPolicy)) {
        issues.push({
          severity: 'error',
          path: `actions[${index}].trigger.stackPolicy`,
          rule: 'allowed_trigger_stack_policy',
          reason: `Unsupported trigger.stackPolicy '${String(triggerStackPolicy)}'`,
        });
      }

      if (triggerCooldown !== undefined) {
        if (!triggerCooldown || typeof triggerCooldown !== 'object' || Array.isArray(triggerCooldown)) {
          issues.push({
            severity: 'error',
            path: `actions[${index}].trigger.cooldown`,
            rule: 'cooldown_object_required',
            reason: 'trigger.cooldown must be an object when provided',
          });
        } else {
          const cooldownValue = (triggerCooldown as Record<string, unknown>).value;
          const cooldownUnit = (triggerCooldown as Record<string, unknown>).unit;

          if (typeof cooldownValue !== 'number' || !Number.isFinite(cooldownValue) || cooldownValue < 0) {
            issues.push({
              severity: 'error',
              path: `actions[${index}].trigger.cooldown.value`,
              rule: 'cooldown_value_non_negative_number',
              reason: 'trigger.cooldown.value must be a non-negative finite number',
            });
          }

          if (typeof cooldownUnit !== 'string' || !cooldownUnit.trim()) {
            issues.push({
              severity: 'error',
              path: `actions[${index}].trigger.cooldown.unit`,
              rule: 'cooldown_unit_required',
              reason: 'trigger.cooldown.unit must be a non-empty string',
            });
          }
        }
      }
    }
  });

  return issues;
}

async function referenceExists(tx: Prisma.TransactionClient, sourceRef: string): Promise<boolean> {
  const checks = await Promise.all([
    tx.class.findFirst({ where: { sourceRef }, select: { id: true } }),
    tx.race.findFirst({ where: { sourceRef }, select: { id: true } }),
    tx.background.findFirst({ where: { sourceRef }, select: { id: true } }),
    tx.feature.findFirst({ where: { sourceRef }, select: { id: true } }),
    tx.item.findFirst({ where: { sourceRef }, select: { id: true } }),
    tx.action.findFirst({ where: { sourceRef }, select: { id: true } }),
    tx.spell.findFirst({ where: { sourceRef }, select: { id: true } }),
  ]);

  return checks.some((entry) => Boolean(entry));
}

async function resolveEntityIdBySourceRef(
  tx: Prisma.TransactionClient,
  sourceType: ChoiceNode['sourceType'],
  sourceExternalId: string
): Promise<string | null> {
  if (sourceType === 'class') {
    const row = await tx.class.findFirst({ where: { sourceRef: sourceExternalId }, select: { id: true } });
    return row?.id || null;
  }

  if (sourceType === 'race') {
    const row = await tx.race.findFirst({ where: { sourceRef: sourceExternalId }, select: { id: true } });
    return row?.id || null;
  }

  if (sourceType === 'background') {
    const row = await tx.background.findFirst({ where: { sourceRef: sourceExternalId }, select: { id: true } });
    return row?.id || null;
  }

  if (sourceType === 'feature') {
    const row = await tx.feature.findFirst({ where: { sourceRef: sourceExternalId }, select: { id: true } });
    return row?.id || null;
  }

  if (sourceType === 'item') {
    const row = await tx.item.findFirst({ where: { sourceRef: sourceExternalId }, select: { id: true } });
    return row?.id || null;
  }

  const row = await tx.spell.findFirst({ where: { sourceRef: sourceExternalId }, select: { id: true } });
  return row?.id || null;
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
  const choices = ensureArray(pack.choices);
  const items = ensureArray(pack.items);
  const progressions = ensureArray(pack.classLevelProgressions);
  const actions = ensureArray(pack.actions);
  const spells = ensureArray(pack.spells);
  const dependencies = ensureArray(pack.dependencies);

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

    for (const node of choices) {
      const sourceId = await resolveEntityIdBySourceRef(tx, node.sourceType, node.sourceExternalId);
      if (!sourceId) {
        throw new ImportIssueError({
          severity: 'error',
          path: `choices.externalId=${node.externalId}`,
          rule: 'choice_source_ref_exists',
          reason: `Unable to resolve sourceExternalId '${node.sourceExternalId}' for sourceType '${node.sourceType}'`,
        });
      }

      const optionsJson = node.options as Prisma.InputJsonValue;
      const existingByRef = await tx.choice.findFirst({ where: { sourceRef: node.externalId } });

      if (existingByRef) {
        if (existingByRef.sourceType !== node.sourceType || existingByRef.sourceId !== sourceId) {
          throw new ImportIssueError({
            severity: 'error',
            path: `choices.externalId=${node.externalId}`,
            rule: 'immutable_choice_binding',
            reason: `Choice '${node.externalId}' is already bound to sourceType='${existingByRef.sourceType}', sourceId='${existingByRef.sourceId}'`,
          });
        }

        await tx.choice.update({
          where: { id: existingByRef.id },
          data: {
            chooseCount: node.chooseCount,
            optionsJson,
            rulesVersion: defaultRulesVersion(node.rulesVersion),
            contentSourceId: contentSource.id,
          },
        });
        continue;
      }

      await tx.choice.create({
        data: {
          contentSourceId: contentSource.id,
          sourceType: node.sourceType,
          sourceId,
          chooseCount: node.chooseCount,
          optionsJson,
          sourceRef: node.externalId,
          rulesVersion: defaultRulesVersion(node.rulesVersion),
        },
      });
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

    const knownPackRefs = new Set<string>([
      ...classes.map((entry) => entry.externalId),
      ...races.map((entry) => entry.externalId),
      ...backgrounds.map((entry) => entry.externalId),
      ...features.map((entry) => entry.externalId),
      ...items.map((entry) => entry.externalId),
      ...actions.map((entry) => entry.externalId),
      ...spells.map((entry) => entry.externalId),
    ]);

    for (const dependency of dependencies) {
      const sourceKnown = knownPackRefs.has(dependency.sourceRef) || (await referenceExists(tx, dependency.sourceRef));
      if (!sourceKnown) {
        throw new ImportIssueError({
          severity: 'error',
          path: `dependencies[sourceRef=${dependency.sourceRef}]`,
          rule: 'dependency_ref_exists',
          reason: `Dependency sourceRef '${dependency.sourceRef}' does not exist in pack or DB`,
        });
      }

      const targetKnown = knownPackRefs.has(dependency.targetRef) || (await referenceExists(tx, dependency.targetRef));
      if (!targetKnown) {
        throw new ImportIssueError({
          severity: 'error',
          path: `dependencies[targetRef=${dependency.targetRef}]`,
          rule: 'dependency_ref_exists',
          reason: `Dependency targetRef '${dependency.targetRef}' does not exist in pack or DB`,
        });
      }

      await tx.ruleDependency.upsert({
        where: {
          sourceRef_targetRef_relationType: {
            sourceRef: dependency.sourceRef,
            targetRef: dependency.targetRef,
            relationType: dependency.relationType,
          },
        },
        update: {
          sourceType: dependency.sourceType || null,
          targetType: dependency.targetType || null,
          rulesVersion: defaultRulesVersion(dependency.rulesVersion),
        },
        create: {
          sourceRef: dependency.sourceRef,
          sourceType: dependency.sourceType || null,
          targetRef: dependency.targetRef,
          targetType: dependency.targetType || null,
          relationType: dependency.relationType,
          rulesVersion: defaultRulesVersion(dependency.rulesVersion),
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
          choices: 0,
          items: 0,
          classLevelProgressions: 0,
          actions: 0,
          spells: 0,
          dependencies: 0,
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
