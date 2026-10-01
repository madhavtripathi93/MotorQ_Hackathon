# VISTA Autonomous Agent Operational Boundaries & Safety Guardrails
**Document Version:** 1.0.0  
**Status:** Locked & Enforced  
**Architectural Reference:** ADR-001 (Deterministic Policy Gate for Agentic Telemetry Consumption)

---

## 1. Executive Summary & Core Principle

In connected fleet systems operating at 100K+ vehicles, autonomous AI agents (such as dispatch optimizers, maintenance assistants, and automated customer triage systems) make operational suggestions based on real-time vehicle data. 

**VISTA's Core Safety Invariant:**  
> **"No generative model, LLM, or probabilistic reasoning engine may ever determine, compute, or override telemetry veracity or physical safety gates."**

AI agents operate strictly on the **consuming** side of VISTA. Before any agent-proposed action can touch a physical vehicle actuator or mission-critical dispatch workflow, it must submit its proposed action to VISTA's **Deterministic Decision Gate** (`POST /api/v1/decisions/evaluate`), which enforces mathematical, empirical, and cryptographic invariants.

```
                           ┌──────────────────────────────┐
                           │   Autonomous AI Agent        │
                           │   (LLM / Optimizer / Triage) │
                           └──────────────┬───────────────┘
                                          │
                     1. Proposes Action   │ (e.g. recalibrate_range)
                                          ▼
                           ┌──────────────────────────────┐
                           │   VISTA Policy Decision Gate │
                           │   (Deterministic & Locked)   │
                           └──────────────┬───────────────┘
                                          │
                ┌─────────────────────────┴─────────────────────────┐
                │                                                   │
      Trust >= Threshold                                  Trust < Threshold
      AND Required Evidence                               OR Forbidden Evidence
      AND All Invariants Pass                             OR Missing Trust Score
                │                                                   │
                ▼                                                   ▼
         [ ALLOW ]                                         [ BLOCK / REVIEW ]
   (Action Dispatched)                             (Averted Physical Harm / Dispatch)
                │                                                   │
                └─────────────────────────┬─────────────────────────┘
                                          │
                                          ▼
                           ┌──────────────────────────────┐
                           │  Append-Only SHA-256 Ledger  │
                           │  (Cryptographic Audit Trail) │
                           └──────────────────────────────┘
```

---

## 2. ADR-001: Deterministic Decision Gate Architecture

### Context
Downstream consumers of vehicle telemetry often employ AI agents to automate decisions (e.g., dynamically recalibrating an electric delivery van's dashboard range, rerouting a driver around a geofence, or scheduling battery thermal preconditioning). If the underlying telemetry suffers from semantic drift (such as an OTA firmware update flipping battery SoC units from 0–100% to 0.0–1.0), an ungrounded AI agent will observe the 100x drop and conclude the vehicle has 3 km of range left, issuing an erroneous emergency tow dispatch.

### Decision
1. **Separation of Concerns:** Veracity detection, statistical attribution, and trust scoring are performed strictly in the 9-stage Veracity Engine and recorded in the 3NF Postgres/Redis/ClickHouse layers.
2. **Deterministic Evaluation:** The Decision Gate evaluates hard mathematical rules against the calibrated trust score $T \in [0.0, 1.0]$ and verified incident evidence.
3. **Fail-Closed by Design:**
   - If a VIN has no telemetry history or no trust score is found, trust defaults to `0.0` (Never `0.95`).
   - If trust data is stale (> 300s old), the action defaults to `REVIEW` or `BLOCK`.
   - Any missing `requiredEvidence` code forces `REVIEW` or `BLOCK`.
   - Any presence of `forbiddenEvidence` (e.g., `GPS_SPOOF_INCONSISTENCY` during `dispatch_tow`) forces `BLOCK`.
4. **Non-Bypassable:** There is no header, token, or prompt instruction that allows an agent to bypass the decision gate.

---

## 3. High-Stakes Action Catalog & Trust Thresholds

| Action Code | Description | Minimum Trust ($T_{min}$) | Required Evidence | Forbidden Evidence | Degraded Mode Policy |
| :--- | :--- | :---: | :--- | :--- | :--- |
| `recalibrate_range` | Dynamic BMS dash range recalculation | **0.90** | `SIGNAL_SCHEMA_VALID`, `PLAUSIBILITY_VALID` | `UNIT_SCALE_INVERSION`, `DRIFT_DETECTED` | **BLOCK** |
| `dispatch_tow` | Emergency recovery vehicle dispatch | **0.85** | `LOCATION_VERIFIED` | `GPS_SPOOF_INCONSISTENCY` | **REVIEW** (Human operator) |
| `remote_immobilize` | Stolen vehicle remote lockout | **0.98** | `CRYPTOGRAPHIC_KEY_VALID`, `LOCATION_VERIFIED` | `GPS_SPOOF_INCONSISTENCY`, `SPEED_DISCREPANCY` | **BLOCK** |
| `battery_precondition` | Extreme temperature battery warmup | **0.75** | `TEMPERATURE_PLAUSIBLE` | `SENSOR_CORRUPTED` | **REVIEW** |
| `ota_campaign_deploy` | Fleet-wide firmware push | **0.95** | `BENIGN_DISTRIBUTION_CONFIRMED`, `CONTRACT_VERIFIED` | `UNIT_SCALE_INVERSION`, `CRITICAL_DRIFT` | **BLOCK** |

---

## 4. Prompt Guardrails for External Agents

When integrating external LLMs or autonomous agents with VISTA via REST or WebSocket:

### Rule 1: No Simulated Veracity
Agents must not simulate or hallucinate trust scores. They must query:
```http
GET /api/v1/vehicles/:vin/trust
```
The response returns the verified real-time trust score, active contract version, and associated incident IDs.

### Rule 2: Mandated Gate Invocation
Every agentic action proposal must call:
```http
POST /api/v1/decisions/evaluate
Content-Type: application/json
Authorization: Bearer <JWT>

{
  "vin": "VIN-000012",
  "requestedAction": "recalibrate_range",
  "actor": "fleet_dispatch_agent_v2",
  "aiProposed": true,
  "rationale": "Observed rapid drop in SoC from 72% to 0.72%"
}
```

### Rule 3: Graceful Handling of `BLOCK` and `REVIEW`
When the Decision Gate responds with:
```json
{
  "status": "success",
  "decision": {
    "outcome": "BLOCK",
    "policy_code": "TRUST_BELOW_THRESHOLD",
    "trust_threshold": 0.90,
    "actual_trust": 0.12,
    "reason_details": {
      "reason": "Actual trust 0.12 below required threshold 0.90 for recalibrate_range"
    }
  }
}
```
The agent **must abort** the execution of the physical action, log the rejection to its execution trace, and notify human dispatch operators with the provided `reason_details`.

---

## 5. Cryptographic Proof of Non-Tampering

All decision evaluations—both permitted and blocked—automatically write a record to the VISTA Audit Ledger. The ledger maintains an immutable SHA-256 hash chain:
$$H_i = \text{SHA256}(H_{i-1} \parallel \text{tenant\_id} \parallel \text{action\_type} \parallel \text{target\_resource} \parallel \text{payload})$$

Any attempt by a compromised agent or rogue process to alter past decisions breaks the cryptographic chain and triggers an alert via `GET /api/v1/audit/verify/chain`.
