import { describe, it, expect } from 'vitest';
import veracityEngine from '../../backend/api/src/veracity/veracityEngine';
import { validateSchema } from '../../backend/api/src/veracity/schemaValidator';
import { validateSequence } from '../../backend/api/src/veracity/sequenceValidator';
import { validatePlausibility } from '../../backend/api/src/veracity/plausibilityValidator';
import { validateFreshness } from '../../backend/api/src/veracity/freshnessValidator';
import { validateCrossSignal } from '../../backend/api/src/veracity/crossSignalValidator';
import { driftValidator } from '../../backend/api/src/veracity/distributionDriftValidator';
import { attributionEngine } from '../../backend/api/src/veracity/cohortAttribution';
import { evaluatePolicyDecision } from '../../backend/api/src/veracity/decisionGate';

describe('VISTA 9-Stage Veracity Engine & Decision Gate (Checkpoint C6, C7, C10)', () => {
  // Stage 1
  it('Stage 1: flags values exceeding contract bounds', () => {
    const contract = { semantic_version: 4, min_value: 0, max_value: 120 };
    const event = { vin: 'VIN-TEST-1', seq: 100, eventTime: new Date().toISOString(), value: 420.5 };
    const result = validateSchema(event, contract);
    expect(result.isValid).toBe(false);
    expect(result.evidence).toContain('VALUE_ABOVE_CONTRACT_MAX');
  });

  // Stage 2
  it('Stage 2: identifies duplicate events and preserves pipeline integrity', async () => {
    const event = { vin: 'VIN-DEDUP-1', seq: 500, signal: 'battery_soc' };
    const first = await validateSequence(event);
    expect(first.isDuplicate).toBe(false);

    const second = await validateSequence(event);
    expect(second.isDuplicate).toBe(true);
    expect(second.evidence).toContain('PIPELINE_DUPLICATE');
  });

  // Stage 3
  it('Stage 3: flags physically impossible acceleration or velocity', () => {
    const event = { vin: 'VIN-TEST-2', signal: 'speed_kmh', value: 450.0, eventTime: new Date().toISOString() };
    const res = validatePlausibility(event);
    expect(res.isPlausible).toBe(false);
    expect(res.evidence).toContain('PHYSICALLY_IMPOSSIBLE_SPEED');
  });

  // Stage 4
  it('Stage 4: decays freshness score according to SLA window', () => {
    const freshEvent = { signal: 'speed_kmh', eventTime: new Date().toISOString() };
    const freshRes = validateFreshness(freshEvent);
    expect(freshRes.freshnessScore).toBeGreaterThan(0.9);
    expect(freshRes.evidence).toContain('FRESH');

    const staleEvent = { signal: 'speed_kmh', eventTime: new Date(Date.now() - 30000).toISOString() };
    const staleRes = validateFreshness(staleEvent);
    expect(staleRes.freshnessScore).toBeLessThan(0.2);
    expect(staleRes.evidence).toContain('EXPIRED_SLA_LATENCY');
  });

  // Stage 5
  it('Stage 5: detects GPS spoofing when position jumps but wheel speed/odometer stay coherent', () => {
    const event = {
      vin: 'VIN-SPOOF-1',
      eventTime: new Date().toISOString(),
      signals: {
        speedKmh: 42.0,
        odometerKm: 15000.012, // 12 meters
        location: { lat: 42.0, lon: -87.5 }, // jumped ~15 km
        previousSignals: {
          speedKmh: 42.0,
          odometerKm: 15000.000,
          location: { lat: 41.8781, lon: -87.6298 },
          eventTime: new Date(Date.now() - 1000).toISOString(),
        },
      },
    };
    const res = validateCrossSignal(event);
    expect(res.isCoherent).toBe(false);
    expect(res.evidence).toContain('GPS_SPOOF_INCONSISTENCY');
    expect(res.consistencyScore).toBeLessThan(0.15);
  });

  // Stage 6
  it('Stage 6: calculates Jensen-Shannon Divergence on distribution shift', () => {
    const baseline = [70, 71, 72, 73, 74, 75, 76, 77, 78, 79];
    const shifted = [0.70, 0.71, 0.72, 0.73, 0.74, 0.75, 0.76, 0.77, 0.78, 0.79];
    const drift = driftValidator.evaluateDrift('test-signal', shifted, baseline);
    expect(drift.driftScore).toBeGreaterThan(0.4);
    expect(drift.isDriftDetected).toBe(true);
  });

  // Stage 7
  it('Stage 7: attributes OTA unit flip to CONTRACT instead of hardware failure', () => {
    const contract = { canonical_name: 'battery_soc', min_value: 0, max_value: 100 };
    const res = attributionEngine.attributeCause({
      signal: 'battery_soc',
      observedValue: 0.72,
      contract,
      firmware: '4.7',
      otaCampaign: 'CAMPAIGN-OTA-47',
      crossSignalCoherent: true,
      isPipelineAnomaly: false,
      isPlausible: false, // out of 0-100 range
      recentDriftScore: 0.8,
      isCohortCorrelated: true,
    });
    expect(res.topClass).toBe('CONTRACT');
    expect(res.probabilities.contract).toBeGreaterThan(0.5);
  });

  // Stage 8 & 9 (Fusion & Decision Gate)
  it('Stage 9: strictly blocks physical recovery dispatch when location trust is degraded (ADR-001)', () => {
    const decision = evaluatePolicyDecision({
      requestedAction: 'dispatch_recovery',
      signalKey: 'location_gps',
      trustScore: 0.08,
      evidence: ['GPS_SPOOF_INCONSISTENCY'],
      actor: 'ai_agent_autonomous',
    });

    expect(decision.outcome).toBe('BLOCK');
    expect(decision.policyCode).toBe('FORBIDDEN_EVIDENCE_DETECTED');
    expect(decision.violatingEvidence).toBe('GPS_SPOOF_INCONSISTENCY');
  });

  it('Stage 9: allows action when telemetry is decision-grade', () => {
    const decision = evaluatePolicyDecision({
      requestedAction: 'recalibrate_range',
      signalKey: 'battery_soc',
      trustScore: 0.94,
      evidence: ['IN_RANGE', 'FRESH'],
      actor: 'operator',
    });

    expect(decision.outcome).toBe('ALLOW');
    expect(decision.policyCode).toBe('POLICY_SATISFIED');
  });
});
