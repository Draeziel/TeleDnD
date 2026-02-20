# ADR-0001: Rules Graph Capability Contract

**Date**: 2026-02-20  
**Status**: Accepted  
**Owner**: Architecture stream (Character Rules Graph Overhaul)

## Context

The system is moving to a single source of truth Rules Graph. Resolver output will be consumed by:
- character sheet rendering,
- draft/choice validation,
- future combat runtime.

Without a strict contract, capability payloads and modifier behavior will drift, and combat integration will become fragile.

## Decision

### 1) Execution Layer placeholder (future-safe)

Add an explicit future layer in architecture:

Rules Graph -> Resolver -> Capability -> Execution

Current stream does **not** implement execution runtime, but reserves contract entry:

- `executionIntent` (optional placeholder now, required for runtime capabilities later)

`executionIntent` purpose:
- declare how a capability is expected to be executed/interpreted by runtime engines,
- prevent resolver payload redesign when combat engine starts consuming capabilities.

### 2) Capability payload typing

Every capability must include both:
- `payloadType` (required discriminator)
- `payload` (typed by payloadType)

No anonymous JSON payloads allowed in resolver contract.

Examples:
- `payloadType: "ACTION_ATTACK"`
- `payloadType: "MODIFIER_ABILITY_SCORE"`
- `payloadType: "PASSIVE_TRAIT"`
- `payloadType: "CHOICE_SELECTION"`

### 3) Modifier conflict policy (fixed modes)

Modifier operations are restricted to the following modes only:
- `add`
- `set`
- `override`
- `multiply`

Any other operation mode is invalid.

Resolver and validators must enforce deterministic conflict resolution using these modes.

## Consequences

Positive:
- Stable contract for sheet + future combat execution.
- Predictable payload interpretation and safer imports.
- Deterministic modifier behavior with explicit operations.

Trade-offs:
- Slightly more verbose capability schema.
- Requires strict payload registry and validation discipline.

## Implementation notes

Phase 0 deliverables:
- publish payloadType registry draft,
- define executionIntent placeholder schema,
- lock modifier precedence semantics for add/set/override/multiply.

Phase 2+:
- enforce payloadType in resolver output and tests,
- reject unsupported modifier operation values at import/validation stage.
