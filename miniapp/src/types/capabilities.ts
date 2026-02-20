export type CapabilityType = 'ACTION' | 'PASSIVE' | 'MODIFIER' | 'CHOICE';

export type CapabilityScope = 'sheet' | 'combat' | 'exploration' | 'social' | 'universal';

export type CapabilityTiming = 'static' | 'runtime';

export type CapabilityLifecycleState = 'active' | 'suspended' | 'expired';

export type ModifierOperation = 'add' | 'set' | 'override' | 'multiply';

export type ExecutionIntentKind =
  | 'manual'
  | 'triggered'
  | 'passive'
  | 'reaction'
  | 'placeholder';

export interface ExecutionIntent {
  kind: ExecutionIntentKind;
  triggerPhase?: 'on_apply' | 'turn_start' | 'turn_end' | 'on_hit' | 'on_damage' | 'on_save' | 'manual';
  description?: string;
}

export type CapabilityPayloadType =
  | 'ACTION_ATTACK'
  | 'PASSIVE_TRAIT'
  | 'MODIFIER_ABILITY_SCORE'
  | 'CHOICE_SELECTION'
  | 'RUNTIME_EFFECT'
  | 'CUSTOM';

export interface CapabilityDto {
  id: string;
  type: CapabilityType;
  sourceType: 'class' | 'race' | 'feature' | 'item' | 'spell' | 'system';
  sourceId: string;
  scope: CapabilityScope;
  timing: CapabilityTiming;
  rulesVersion: string;
  payloadType: CapabilityPayloadType;
  payload: Record<string, unknown>;
  executionIntent?: ExecutionIntent;
  lifecycleState: CapabilityLifecycleState;
}

export interface ResolverMetadata {
  rulesVersion: string;
  resolverSchemaVersion: string;
  computedAt: string;
  sourceGraphDigest: string;
}

export interface ResolveCapabilitiesResponse {
  actions: CapabilityDto[];
  passiveFeatures: CapabilityDto[];
  modifiers: CapabilityDto[];
  choicesRemaining: CapabilityDto[];
  metadata: ResolverMetadata;
}
