# ADR-005: Semantic Contracts as Versioned Relational Artifacts; Drift Requires Attribution Before Quarantine

## Status
Accepted (Locked Execution Plan)

## Context
A major flaw in naive telemetry validation systems is treating any statistical distribution shift as an immediate "sensor failure" or "data corruption". In connected fleets:
- Rush hour traffic causes average vehicle speeds to plummet and brake event frequency to spike (Benign Distribution Shift).
- Over-The-Air (OTA) updates may change units (e.g. Battery State-of-Charge scale compressed from `0..100` to `0.0..1.0`), sampling frequency (1 Hz to 5 Hz), or enum representations (`HARSH_BRAKE` to `HBRAKE`).
- Real physical events (e.g. emergency braking or rapid battery discharge under freezing conditions) exhibit synchronous cross-signal changes.

Prematurely quarantining telemetry without semantic attribution leads to false alarms, blocked legitimate vehicle operations, and missed software regressions.

## Decision
1. **Semantic Contracts as First-Class Entities**:
   - Every signal has a versioned contract (`signal_contract`) defining units, sampling frequency, physical min/max, semantics schema, and active time validity window.
   - Contract diffs (`contract_change`) track exact semantic differences, deployment tickets, and timestamps.
2. **Three-Way Cause Attribution**:
   - The Veracity Engine evaluates changes against four explicit causal categories:
     - `VEHICLE`: Physical vehicle change supported by cross-signal invariants (e.g., speed drop matches brake pressure and deceleration).
     - `TELEMETRY`: Hardware/sensor malfunction or pipeline corruption (e.g., speed=400 km/h with 0 RPM and no odometer change).
     - `CONTRACT`: Semantic drift caused by unannounced OTA firmware modifications or contract mismatch (e.g., values mapped into 0..1 coinciding with firmware rollout cohort).
     - `UNKNOWN`: Insufficient evidence or conflicting signals; triggers fallback investigation.
3. **Difference-in-Differences (DiD) Cohort Verification**:
   - For suspected semantic drift, an asynchronous batch job compares the treatment cohort (vehicles on new firmware) against a parallel control cohort (vehicles on legacy firmware) across pre- and post-windows, with placebo date validation.
4. **Attribution Before Quarantine**:
   - Data is flagged as uncertain and downstream consumers are protected, but root-cause attribution is derived and presented before marking signals permanently invalid.

## Consequences
- **Positive**: Eliminates false-positive quarantines caused by benign weather or traffic patterns. Identifies root causes of OTA breakages within minutes.
- **Traceable**: Provides engineers with explicit contract diffs and avoided downstream harm estimates.
