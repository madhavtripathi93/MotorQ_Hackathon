# ADR-001: LLM Never Decides Trust

## Status
Accepted (Locked Execution Plan)

## Context
Connected vehicle fleets emit hundreds of thousands of events per second across heterogeneous sensor platforms and ECUs. When telemetry anomalies arise—such as GPS jumps, unit inversions, or sensor dropouts—downstream automated systems (such as high-voltage contactor dispatches, recovery towing, emergency braking scoring, or battery warranty re-evaluations) require deterministic, auditable decisions.

Large Language Models (LLMs) are probabilistic, subject to hallucinations, non-deterministic in reasoning under boundary conditions, and incapable of low-latency (<5ms) evaluation on streaming pipelines. If an LLM were permitted to compute trust scores, relax safety thresholds, or authoritatively override anomaly classifications, safety and regulatory compliance would be fundamentally compromised.

## Decision
1. **Veracity Engine Authority**: Telemetry veracity (trust scores, confidence intervals, and reason codes) is computed purely by deterministic signal checks and calibrated statistical models running in the data plane (Flink / Node.js worker-sharded veracity engine).
2. **Policy Object Authority**: Action authorization (`ALLOW`, `REVIEW`, `BLOCK`) is strictly evaluated by a deterministic policy engine based on pre-registered trust thresholds, freshness windows, and required evidence completeness.
3. **Agent Scope**: AI agents operate exclusively as investigation and explanation assistants within the control plane:
   - Permitted: Explain incidents, synthesize evidence chains, query historical incident similarity, draft incident reports, and simulate action prerequisites using read-only APIs (`get_vehicle_trust`, `get_incident_evidence`, `simulate_action`).
   - Forbidden: Lowering trust thresholds, overriding policy blocks, forging provenance, or executing un-gated mutations.
4. **Audit Trail**: Every evaluation by the decision gateway and every proposal by the agent must record an immutable audit entry in `audit.v1` and the relational store.

## Consequences
- **Positive**: Safety guarantees remain mathematically defensible; zero risk of hallucinations corrupting physical vehicle safety or dispatch actions.
- **Auditable**: Every decision can be replayed and verified against the exact evidence bundle and policy version at timestamp $T$.
- **Downstream**: Operators have full confidence that "BLOCK" decisions cannot be subverted by prompt injection or conversational drift.
