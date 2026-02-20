import type {
  CapabilityPayloadType,
  ModifierOperation,
  ExecutionIntent,
  CapabilityLifecycleState,
} from '../types/capabilities';

const ALLOWED_MODIFIER_OPERATIONS: ModifierOperation[] = ['add', 'set', 'override', 'multiply'];
const ALLOWED_LIFECYCLE_STATES: CapabilityLifecycleState[] = ['active', 'suspended', 'expired'];
const ALLOWED_PAYLOAD_TYPES: CapabilityPayloadType[] = [
  'ACTION_ATTACK',
  'PASSIVE_TRAIT',
  'MODIFIER_ABILITY_SCORE',
  'CHOICE_SELECTION',
  'RUNTIME_EFFECT',
  'CUSTOM',
];

export function isAllowedModifierOperation(value: string): value is ModifierOperation {
  return ALLOWED_MODIFIER_OPERATIONS.includes(value as ModifierOperation);
}

export function assertAllowedModifierOperation(value: string): ModifierOperation {
  if (!isAllowedModifierOperation(value)) {
    throw new Error(`Validation: unsupported modifier operation \"${value}\". Allowed: ${ALLOWED_MODIFIER_OPERATIONS.join(', ')}`);
  }

  return value;
}

export function isAllowedCapabilityPayloadType(value: string): value is CapabilityPayloadType {
  return ALLOWED_PAYLOAD_TYPES.includes(value as CapabilityPayloadType);
}

export function assertAllowedCapabilityPayloadType(value: string): CapabilityPayloadType {
  if (!isAllowedCapabilityPayloadType(value)) {
    throw new Error(`Validation: unsupported capability payloadType \"${value}\".`);
  }

  return value;
}

export function isAllowedLifecycleState(value: string): value is CapabilityLifecycleState {
  return ALLOWED_LIFECYCLE_STATES.includes(value as CapabilityLifecycleState);
}

export function assertAllowedLifecycleState(value: string): CapabilityLifecycleState {
  if (!isAllowedLifecycleState(value)) {
    throw new Error(`Validation: unsupported lifecycleState \"${value}\".`);
  }

  return value;
}

export function normalizeExecutionIntent(intent: ExecutionIntent | null | undefined): ExecutionIntent | undefined {
  if (!intent) {
    return undefined;
  }

  if (!intent.kind) {
    return {
      kind: 'placeholder',
      description: intent.description,
      triggerPhase: intent.triggerPhase,
    };
  }

  return intent;
}
