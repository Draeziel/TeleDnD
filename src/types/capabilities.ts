export type CapabilityType = 'ACTION' | 'PASSIVE' | 'MODIFIER' | 'CHOICE';

export type CapabilityScope = 'sheet' | 'combat' | 'exploration' | 'social' | 'universal';

export type CapabilityTiming = 'static' | 'runtime';

export type CapabilityLifecycleState = 'active' | 'suspended' | 'expired';

export type ModifierOperation = 'add' | 'set' | 'override' | 'multiply';

export type CapabilityTriggerPhase = 'on_apply' | 'turn_start' | 'turn_end' | 'on_hit' | 'on_damage' | 'on_save' | 'manual';

export type CapabilityTriggerTargeting = 'self' | 'ally' | 'enemy' | 'area' | 'explicit';

export type CapabilityTriggerStackPolicy = 'refresh' | 'stack' | 'ignore' | 'replace';

export interface CapabilityTrigger {
  phase: CapabilityTriggerPhase;
  condition?: Record<string, unknown>;
  targeting: CapabilityTriggerTargeting;
  cooldown?: {
    value: number;
    unit: string;
  };
  stackPolicy: CapabilityTriggerStackPolicy;
}

export type ExecutionIntentKind =
  | 'manual'
  | 'triggered'
  | 'passive'
  | 'reaction'
  | 'placeholder';

export interface ExecutionIntent {
  kind: ExecutionIntentKind;
  triggerPhase?: CapabilityTriggerPhase;
  description?: string;
}

export type CapabilityPayloadType =
  | 'ACTION_ATTACK'
  | 'PASSIVE_TRAIT'
  | 'MODIFIER_ABILITY_SCORE'
  | 'CHOICE_SELECTION'
  | 'RUNTIME_EFFECT'
  | 'CUSTOM';

export interface CapabilityBaseDto {
  id: string;
  type: CapabilityType;
  sourceType: 'class' | 'race' | 'feature' | 'item' | 'spell' | 'system';
  sourceId: string;
  scope: CapabilityScope;
  timing: CapabilityTiming;
  rulesVersion: string;
  payloadType: CapabilityPayloadType;
  payload: Record<string, unknown>;
  trigger?: CapabilityTrigger;
  executionIntent?: ExecutionIntent;
  lifecycleState: CapabilityLifecycleState;
}

export interface ResolverMetadataDto {
  rulesVersion: string;
  resolverSchemaVersion: string;
  computedAt: string;
  sourceGraphDigest: string;
}

export interface ResolveCapabilitiesDto {
  actions: CapabilityBaseDto[];
  passiveFeatures: CapabilityBaseDto[];
  modifiers: CapabilityBaseDto[];
  choicesRemaining: CapabilityBaseDto[];
  metadata: ResolverMetadataDto;
}

export interface ResolverStageTiming {
  stage: string;
  durationMs: number;
}

export interface ResolverTelemetrySnapshot {
  traceId: string;
  characterId: string;
  resolverSchemaVersion: string;
  rulesVersion: string;
  durationMs: number;
  cacheHit: boolean;
  recomputeMode: 'full' | 'partial';
  dirtyNodeCount: number;
  stages: ResolverStageTiming[];
  createdAt: string;
}

export interface ResolverTelemetrySink {
  record(snapshot: ResolverTelemetrySnapshot): void | Promise<void>;
}

export const RESOLVER_SCHEMA_VERSION = '1.0.0';
