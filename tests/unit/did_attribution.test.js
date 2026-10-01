import { describe, it, expect } from 'vitest';
import { estimateDifferenceInDifferences } from '../../backend/batch-attribution/src/jobs/did.job';
import { runPlaceboTest } from '../../backend/batch-attribution/src/jobs/placebo.job';
import { runPreTrendTest } from '../../backend/batch-attribution/src/jobs/pretrend.job';
import harmEstimator from '../../backend/batch-attribution/src/services/harmEstimator.service';

describe('Batch Attribution & DiD Protocol (Checkpoint C8 & Acceptance Gate 2)', () => {
  it('correctly calculates DiD when treatment cohort exhibits OTA unit flip', () => {
    const treatPre = [72.5, 71.8, 73.0, 72.1];
    const treatPost = [0.725, 0.718, 0.730, 0.721]; // values compressed by 100x
    const ctrlPre = [71.9, 72.4, 71.5, 72.2];
    const ctrlPost = [71.7, 72.0, 71.8, 72.1];

    const result = estimateDifferenceInDifferences({
      treatmentPreValues: treatPre,
      treatmentPostValues: treatPost,
      controlPreValues: ctrlPre,
      controlPostValues: ctrlPost,
    });

    expect(result.did).toBeLessThan(-70.0);
    expect(result.isStatisticallySignificant).toBe(true);
    expect(result.confidenceInterval[0]).toBeLessThan(result.confidenceInterval[1]);
  });

  it('passes placebo test on parallel pre-intervention data (no spurious divergence)', () => {
    const treatPre = [72.5, 72.1, 72.0, 72.4];
    const ctrlPre = [72.0, 71.9, 72.2, 72.1];

    const placebo = runPlaceboTest({
      treatmentPreValues: treatPre,
      controlPreValues: ctrlPre,
    });

    expect(placebo.passed).toBe(true);
    expect(Math.abs(placebo.placeboDid)).toBeLessThan(0.5);
  });

  it('validates pre-trend parallelism between treatment and control cohorts', () => {
    const treatPre = [70.0, 70.5, 71.0, 71.5];
    const ctrlPre = [70.1, 70.6, 71.1, 71.6];

    const pretrend = runPreTrendTest(treatPre, ctrlPre);
    expect(pretrend.passed).toBe(true);
    expect(pretrend.slopeDifference).toBeLessThan(0.05);
  });

  it('quantifies downstream harm with explicit avoided-impact formula', () => {
    const harm = harmEstimator.quantifyOtaUnitFlipHarm({
      affectedVehicles: 10000,
      unmitigatedObservedSoc: 0.72,
      nominalExpectedSoc: 72.0,
    });

    expect(harm.estimatedImpact.rangeMaeKm).toBeGreaterThan(250);
    expect(harm.estimatedImpact.falseAlerts).toBeGreaterThan(1000);
    expect(harm.estimatedImpact.blockedActions).toBeGreaterThan(10);
    expect(harm.estimatedImpact.label).toBe('simulator-derived avoided-impact estimate');
    expect(harm.estimatedImpact.formula).toContain('AvoidedImpact');
  });
});
