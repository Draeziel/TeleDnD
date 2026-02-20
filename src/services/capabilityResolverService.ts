import crypto from 'crypto';
import { PrismaClient, RuleDependency } from '@prisma/client';
import {
  CapabilityBaseDto,
  ResolveCapabilitiesDto,
  RESOLVER_SCHEMA_VERSION,
  ResolverTelemetrySink,
  ResolverTelemetrySnapshot,
  ResolverStageTiming,
} from '../types';
import {
  assertAllowedCapabilityPayloadType,
  assertAllowedLifecycleState,
  assertAllowedModifierOperation,
  normalizeCapabilityTrigger,
  normalizeExecutionIntent,
} from '../utils/capabilityContracts';
import logger from '../utils/logger';

type ResolveCapabilitiesOptions = {
  dirtyNodeIds?: string[];
};

type ResolverCacheEntry = {
  response: ResolveCapabilitiesDto;
  sourceGraphDigest: string;
  cachedAt: number;
};

const CACHE_TTL_MS = 30_000;
const IMPACTFUL_DIRTY_PREFIXES = [
  'character:',
  'class:',
  'race:',
  'background:',
  'feature:',
  'modifier:',
  'item:',
  'choice:',
  'graph:',
];

export class CapabilityResolverService {
  private prisma: PrismaClient;
  private telemetrySink?: ResolverTelemetrySink;
  private static cache = new Map<string, ResolverCacheEntry>();

  constructor(prisma: PrismaClient, telemetrySink?: ResolverTelemetrySink) {
    this.prisma = prisma;
    this.telemetrySink = telemetrySink;
  }

  async resolveCharacterCapabilities(
    characterId: string,
    telegramUserId: string,
    options: ResolveCapabilitiesOptions = {}
  ): Promise<ResolveCapabilitiesDto> {
    const startedAt = Date.now();
    const traceId = crypto.randomUUID();
    const stages: ResolverStageTiming[] = [];
    const dirtyNodeIds = options.dirtyNodeIds || [];

    const authStart = Date.now();
    const user = await this.prisma.user.upsert({
      where: { telegramId: telegramUserId },
      update: {},
      create: { telegramId: telegramUserId },
    });

    const character = await this.prisma.character.findFirst({
      where: {
        id: characterId,
        ownerUserId: user.id,
      },
      select: {
        id: true,
        level: true,
        classId: true,
        raceId: true,
        backgroundId: true,
        class: {
          select: {
            sourceRef: true,
          },
        },
        race: {
          select: {
            sourceRef: true,
          },
        },
        background: {
          select: {
            sourceRef: true,
          },
        },
      },
    });

    if (!character) {
      throw new Error('Character not found');
    }

    stages.push({ stage: 'ownership-check', durationMs: Date.now() - authStart });

    const planningStart = Date.now();
    const rulesVersion = String(process.env.RULES_VERSION || 'v1');
    const sourceGraphDigest = crypto
      .createHash('sha256')
      .update(`${character.id}:${character.level}:${character.classId || '-'}:${character.raceId || '-'}:${character.backgroundId || '-'}:${rulesVersion}`)
      .digest('hex')
      .slice(0, 24);
    const cacheKey = `${character.id}:${rulesVersion}:${RESOLVER_SCHEMA_VERSION}`;
    stages.push({ stage: 'planning', durationMs: Date.now() - planningStart });

    const cacheLookupStart = Date.now();
    const cached = CapabilityResolverService.cache.get(cacheKey);
    const isImpactfulDirtySet = this.isImpactfulDirtySet(dirtyNodeIds);
    if (cached && this.isCacheEntryValid(cached, sourceGraphDigest) && (!isImpactfulDirtySet || dirtyNodeIds.length === 0)) {
      stages.push({ stage: 'cache-hit', durationMs: Date.now() - cacheLookupStart });

      await this.recordTelemetry({
        traceId,
        characterId: character.id,
        resolverSchemaVersion: RESOLVER_SCHEMA_VERSION,
        rulesVersion,
        durationMs: Date.now() - startedAt,
        cacheHit: true,
        recomputeMode: dirtyNodeIds.length > 0 ? 'partial' : 'full',
        dirtyNodeCount: dirtyNodeIds.length,
        stages,
        createdAt: new Date().toISOString(),
      });

      return cached.response;
    }
    stages.push({ stage: 'cache-miss', durationMs: Date.now() - cacheLookupStart });

    const graphLoadStart = Date.now();
    const classProgressionsPromise = this.prisma.classLevelProgression.findMany({
      where: {
        classId: character.classId,
        level: {
          lte: character.level,
        },
      },
      select: {
        featureId: true,
        level: true,
      },
      orderBy: [
        { level: 'asc' },
        { featureId: 'asc' },
      ],
    });

    const classFeaturesPromise = this.prisma.classFeature.findMany({
      where: {
        classId: character.classId,
        levelRequired: {
          lte: character.level,
        },
      },
      select: {
        featureId: true,
        levelRequired: true,
      },
      orderBy: [
        { levelRequired: 'asc' },
        { featureId: 'asc' },
      ],
    });

    const raceFeaturesPromise = character.raceId
      ? this.prisma.raceFeature.findMany({
          where: {
            raceId: character.raceId,
          },
          select: {
            featureId: true,
          },
          orderBy: {
            featureId: 'asc',
          },
        })
      : Promise.resolve([] as Array<{ featureId: string }>);

    const backgroundFeaturesPromise = character.backgroundId
      ? this.prisma.backgroundFeature.findMany({
          where: {
            backgroundId: character.backgroundId,
          },
          select: {
            featureId: true,
          },
          orderBy: {
            featureId: 'asc',
          },
        })
      : Promise.resolve([] as Array<{ featureId: string }>);

    const [classProgressions, classFeatures, raceFeatures, backgroundFeatures] = await Promise.all([
      classProgressionsPromise,
      classFeaturesPromise,
      raceFeaturesPromise,
      backgroundFeaturesPromise,
    ]);

    const featureIds = new Set<string>([
      ...classProgressions.map((item) => item.featureId),
      ...classFeatures.map((item) => item.featureId),
      ...raceFeatures.map((item) => item.featureId),
      ...backgroundFeatures.map((item) => item.featureId),
    ]);

    const featureList = featureIds.size > 0
      ? await this.prisma.feature.findMany({
          where: {
            id: {
              in: Array.from(featureIds),
            },
          },
          select: {
            id: true,
            name: true,
            description: true,
            sourceRef: true,
          },
          orderBy: {
            id: 'asc',
          },
        })
      : [];

    const modifierList = featureIds.size > 0
      ? await this.prisma.modifier.findMany({
          where: {
            sourceType: 'feature',
            sourceId: {
              in: Array.from(featureIds),
            },
          },
          orderBy: {
            sourceId: 'asc',
          },
        })
      : [];

    const actionList = featureIds.size > 0
      ? await this.prisma.action.findMany({
          where: {
            featureId: {
              in: Array.from(featureIds),
            },
          },
          select: {
            id: true,
            featureId: true,
            name: true,
            description: true,
            payloadType: true,
            payloadJson: true,
            triggerJson: true,
            sourceRef: true,
            rulesVersion: true,
          },
          orderBy: {
            id: 'asc',
          },
        })
      : [];
    stages.push({ stage: 'graph-load', durationMs: Date.now() - graphLoadStart });

    const mapStart = Date.now();
    const featureSourceRefById = new Map<string, string>();
    featureList.forEach((feature) => {
      featureSourceRefById.set(feature.id, feature.sourceRef || `feature:${feature.id}`);
    });

    const passiveFeatures: CapabilityBaseDto[] = featureList.map((feature) => this.buildCapability({
      capabilityType: 'PASSIVE',
      sourceType: 'feature',
      sourceId: feature.id,
      scope: 'sheet',
      timing: 'static',
      rulesVersion,
      payloadType: 'PASSIVE_TRAIT',
      payload: {
        sourceRef: feature.sourceRef || `feature:${feature.id}`,
        name: feature.name,
        description: feature.description || null,
      },
      executionIntent: {
        kind: 'passive',
      },
      lifecycleState: 'active',
    }));

    const modifiers: CapabilityBaseDto[] = modifierList.map((modifier) => {
      const operation = assertAllowedModifierOperation(modifier.operation);
      return this.buildCapability({
        capabilityType: 'MODIFIER',
        sourceType: 'feature',
        sourceId: modifier.sourceId,
        scope: 'sheet',
        timing: 'static',
        rulesVersion,
        payloadType: modifier.target === 'ability' ? 'MODIFIER_ABILITY_SCORE' : 'CUSTOM',
        payload: {
          sourceRef: featureSourceRefById.get(modifier.sourceId) || `feature:${modifier.sourceId}`,
          operation,
          target: modifier.target,
          targetKey: modifier.targetKey || null,
          value: modifier.value,
        },
        executionIntent: {
          kind: 'passive',
        },
        lifecycleState: 'active',
      });
    }).sort((left, right) => left.id.localeCompare(right.id));

    const actions: CapabilityBaseDto[] = actionList.map((action) => {
      const payloadObject = action.payloadJson && typeof action.payloadJson === 'object' && !Array.isArray(action.payloadJson)
        ? (action.payloadJson as Record<string, unknown>)
        : {};
      const triggerObject = action.triggerJson && typeof action.triggerJson === 'object' && !Array.isArray(action.triggerJson)
        ? (action.triggerJson as unknown as CapabilityBaseDto['trigger'])
        : undefined;
      const payloadType = assertAllowedCapabilityPayloadType(action.payloadType);
      const sourceRef = action.sourceRef || `action:${action.id}`;

      return this.buildCapability({
        capabilityType: 'ACTION',
        sourceType: action.featureId ? 'feature' : 'system',
        sourceId: action.featureId || action.id,
        scope: payloadType === 'ACTION_ATTACK' || payloadType === 'RUNTIME_EFFECT' ? 'combat' : 'universal',
        timing: 'runtime',
        rulesVersion: action.rulesVersion || rulesVersion,
        payloadType,
        payload: {
          sourceRef,
          name: action.name,
          description: action.description || null,
          ...payloadObject,
        },
        trigger: triggerObject,
        executionIntent: {
          kind: triggerObject?.phase === 'manual' || !triggerObject ? 'manual' : 'triggered',
          triggerPhase: triggerObject?.phase,
        },
        lifecycleState: 'active',
      });
    }).sort((left, right) => left.id.localeCompare(right.id));
    stages.push({ stage: 'capability-map', durationMs: Date.now() - mapStart });

    const normalizeStart = Date.now();
    const normalizedActions = actions.map((capability) => this.normalizeCapability(capability));
    const normalizedPassive = passiveFeatures.map((capability) => this.normalizeCapability(capability));
    const normalizedModifiers = modifiers.map((capability) => this.normalizeCapability(capability));
    stages.push({ stage: 'normalize', durationMs: Date.now() - normalizeStart });

    const dependencyStart = Date.now();
    const activeContextRefs = new Set<string>(
      [
        character.class?.sourceRef,
        character.race?.sourceRef,
        character.background?.sourceRef,
      ].filter((value): value is string => Boolean(value))
    );

    const dependencyFiltered = await this.applyDependencyConstraints({
      actions: normalizedActions,
      passiveFeatures: normalizedPassive,
      modifiers: normalizedModifiers,
      choicesRemaining: [],
      metadata: {
        rulesVersion,
        resolverSchemaVersion: RESOLVER_SCHEMA_VERSION,
        computedAt: new Date().toISOString(),
        sourceGraphDigest,
      },
    }, activeContextRefs);
    stages.push({ stage: 'dependency-filter', durationMs: Date.now() - dependencyStart });

    const response: ResolveCapabilitiesDto = {
      actions: dependencyFiltered.actions,
      passiveFeatures: dependencyFiltered.passiveFeatures,
      modifiers: dependencyFiltered.modifiers,
      choicesRemaining: dependencyFiltered.choicesRemaining,
      metadata: {
        rulesVersion,
        resolverSchemaVersion: RESOLVER_SCHEMA_VERSION,
        computedAt: new Date().toISOString(),
        sourceGraphDigest,
      },
    };

    const cacheStoreStart = Date.now();
    CapabilityResolverService.cache.set(cacheKey, {
      response,
      sourceGraphDigest,
      cachedAt: Date.now(),
    });
    stages.push({ stage: 'cache-store', durationMs: Date.now() - cacheStoreStart });

    const totalDurationMs = Date.now() - startedAt;
    await this.recordTelemetry({
      traceId,
      characterId: character.id,
      resolverSchemaVersion: RESOLVER_SCHEMA_VERSION,
      rulesVersion,
      durationMs: totalDurationMs,
      cacheHit: false,
      recomputeMode: dirtyNodeIds.length > 0 ? 'partial' : 'full',
      dirtyNodeCount: dirtyNodeIds.length,
      stages,
      createdAt: new Date().toISOString(),
    });

    return response;
  }

  private buildCapability(input: {
    capabilityType: CapabilityBaseDto['type'];
    sourceType: CapabilityBaseDto['sourceType'];
    sourceId: string;
    scope: CapabilityBaseDto['scope'];
    timing: CapabilityBaseDto['timing'];
    rulesVersion: string;
    payloadType: CapabilityBaseDto['payloadType'];
    payload: Record<string, unknown>;
    trigger?: CapabilityBaseDto['trigger'];
    executionIntent?: CapabilityBaseDto['executionIntent'];
    lifecycleState: CapabilityBaseDto['lifecycleState'];
  }): CapabilityBaseDto {
    const id = crypto
      .createHash('sha1')
      .update(`${input.capabilityType}:${input.sourceType}:${input.sourceId}:${input.payloadType}:${input.rulesVersion}`)
      .digest('hex')
      .slice(0, 20);

    return {
      id,
      type: input.capabilityType,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      scope: input.scope,
      timing: input.timing,
      rulesVersion: input.rulesVersion,
      payloadType: input.payloadType,
      payload: input.payload,
      trigger: input.trigger,
      executionIntent: input.executionIntent,
      lifecycleState: input.lifecycleState,
    };
  }

  private async applyDependencyConstraints(
    capabilities: ResolveCapabilitiesDto,
    activeContextRefs: Set<string>
  ): Promise<ResolveCapabilitiesDto> {
    const byBucket = [
      ...capabilities.actions,
      ...capabilities.passiveFeatures,
      ...capabilities.modifiers,
      ...capabilities.choicesRemaining,
    ];

    const capabilitySourceRefs = Array.from(
      new Set(
        byBucket
          .map((capability) => capability.payload.sourceRef)
          .filter((value): value is string => typeof value === 'string' && value.length > 0)
      )
    );

    if (capabilitySourceRefs.length === 0) {
      return capabilities;
    }

    const dependencies = await this.prisma.ruleDependency.findMany({
      where: {
        sourceRef: {
          in: capabilitySourceRefs,
        },
      },
      orderBy: [
        { sourceRef: 'asc' },
        { relationType: 'asc' },
        { targetRef: 'asc' },
      ],
    });

    if (dependencies.length === 0) {
      return capabilities;
    }

    const dependencyBySource = new Map<string, RuleDependency[]>();
    dependencies.forEach((dependency) => {
      if (!dependencyBySource.has(dependency.sourceRef)) {
        dependencyBySource.set(dependency.sourceRef, []);
      }

      dependencyBySource.get(dependency.sourceRef)!.push(dependency);
    });

    const allActiveRefs = new Set<string>([
      ...activeContextRefs,
      ...capabilitySourceRefs,
    ]);

    const filterBucket = (bucket: CapabilityBaseDto[]): CapabilityBaseDto[] => {
      return bucket.filter((capability) => {
        const sourceRef = capability.payload.sourceRef;
        if (typeof sourceRef !== 'string' || sourceRef.length === 0) {
          return true;
        }

        const sourceDependencies = dependencyBySource.get(sourceRef) || [];
        if (sourceDependencies.length === 0) {
          return true;
        }

        for (const dependency of sourceDependencies) {
          if ((dependency.relationType === 'requires' || dependency.relationType === 'depends_on') && !allActiveRefs.has(dependency.targetRef)) {
            return false;
          }

          if (dependency.relationType === 'excludes' && allActiveRefs.has(dependency.targetRef)) {
            return false;
          }
        }

        return true;
      });
    };

    return {
      actions: filterBucket(capabilities.actions),
      passiveFeatures: filterBucket(capabilities.passiveFeatures),
      modifiers: filterBucket(capabilities.modifiers),
      choicesRemaining: filterBucket(capabilities.choicesRemaining),
      metadata: capabilities.metadata,
    };
  }

  private normalizeCapability(capability: CapabilityBaseDto): CapabilityBaseDto {
    const payloadType = assertAllowedCapabilityPayloadType(capability.payloadType);
    const lifecycleState = assertAllowedLifecycleState(capability.lifecycleState);

    return {
      ...capability,
      payloadType,
      lifecycleState,
      trigger: normalizeCapabilityTrigger(capability.trigger),
      executionIntent: normalizeExecutionIntent(capability.executionIntent),
    };
  }

  private isImpactfulDirtySet(dirtyNodeIds: string[]): boolean {
    return dirtyNodeIds.some((dirtyNodeId) => IMPACTFUL_DIRTY_PREFIXES.some((prefix) => dirtyNodeId.startsWith(prefix)));
  }

  private isCacheEntryValid(entry: ResolverCacheEntry, digest: string): boolean {
    if (entry.sourceGraphDigest !== digest) {
      return false;
    }

    return Date.now() - entry.cachedAt <= CACHE_TTL_MS;
  }

  private async recordTelemetry(snapshot: ResolverTelemetrySnapshot): Promise<void> {
    if (this.telemetrySink) {
      await this.telemetrySink.record(snapshot);
      return;
    }

    logger.info('resolver_telemetry', {
      traceId: snapshot.traceId,
      characterId: snapshot.characterId,
      resolverSchemaVersion: snapshot.resolverSchemaVersion,
      rulesVersion: snapshot.rulesVersion,
      durationMs: snapshot.durationMs,
      cacheHit: snapshot.cacheHit,
      recomputeMode: snapshot.recomputeMode,
      dirtyNodeCount: snapshot.dirtyNodeCount,
      stages: snapshot.stages,
    });
  }
}

export default CapabilityResolverService;
