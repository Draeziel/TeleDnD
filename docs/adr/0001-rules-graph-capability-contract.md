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
- align runtime lifecycle transitions (`active -> suspended -> expired`) with execution semantics later.

### 2) Capability payload typing

Every capability must include both:
- `payloadType` (required discriminator)
- `payload` (typed by payloadType)

Capability lifecycle placeholder is required in contract:
- `lifecycleState` (future runtime concern)

Allowed lifecycle states (contract-level, no runtime implementation in this stream):
- `active`
- `suspended`
- `expired`

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

### 4) Execution and runtime boundaries

Execution path is part of architecture contract:
- `Rules Graph -> Resolver -> Capability -> Execution`

Runtime concerns are not implemented in this ADR scope, but are reserved by contract:
- `executionIntent` placeholder,
- `lifecycleState` placeholder (`active | suspended | expired`).

Combat/session services must not become implicit execution engines for raw capability payloads.

### 5) Resolver non-functional guardrails (mandatory)

To prevent resolver-centric bottlenecks, the following NFRs are required:
- deterministic capability IDs,
- cache strategy,
- partial/dirty recompute strategy,
- observability contract (trace id, stage timings, cache-hit ratio, recompute depth).

### 6) Event normalization guardrail (runtime-facing)

For future playback and debugging consistency, execution-facing events must follow normalized envelope:
- `type + actor + target + payload`.

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
- define lifecycleState placeholder schema (`active | suspended | expired`),
- lock modifier precedence semantics for add/set/override/multiply.

Phase 2+:
- enforce payloadType in resolver output and tests,
- reject unsupported modifier operation values at import/validation stage.
- enforce resolver observability metrics in tests and diagnostics.
