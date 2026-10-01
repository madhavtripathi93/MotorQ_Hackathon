// Stage 6: Distribution Drift (JSD) & Page-Hinkley Change-Point Detection

class DistributionDriftValidator {
  constructor() {
    this.signalWindows = new Map();
    this.pageHinkleyStates = new Map();
  }

  // Build histogram with B bins
  buildHistogram(values, minVal = 0, maxVal = 100, numBins = 20) {
    const bins = new Array(numBins).fill(1e-6); // Laplace smoothing
    const binWidth = (maxVal - minVal) / numBins;

    for (const v of values) {
      if (typeof v !== 'number' || isNaN(v)) continue;
      const idx = Math.min(numBins - 1, Math.max(0, Math.floor((v - minVal) / binWidth)));
      bins[idx] += 1;
    }

    const sum = bins.reduce((a, b) => a + b, 0);
    return bins.map(b => b / sum);
  }

  // Jensen-Shannon Divergence calculation
  calculateJSD(p, q) {
    if (p.length !== q.length) return 0;
    const m = p.map((pVal, i) => 0.5 * (pVal + q[i]));

    const kl = (distA, distM) => {
      let sum = 0;
      for (let i = 0; i < distA.length; i++) {
        if (distA[i] > 0) {
          sum += distA[i] * Math.log(distA[i] / distM[i]);
        }
      }
      return sum;
    };

    const jsd = 0.5 * kl(p, m) + 0.5 * kl(q, m);
    // Normalize by ln(2)
    return Math.sqrt(Math.max(0, jsd / Math.LN2));
  }

  // Page-Hinkley test for abrupt change detection
  updatePageHinkley(signalKey, value, delta = 0.05, threshold = 2.5) {
    if (!this.pageHinkleyStates.has(signalKey)) {
      this.pageHinkleyStates.set(signalKey, {
        mean: value,
        count: 1,
        m: 0,
        minM: 0,
      });
      return false;
    }

    const state = this.pageHinkleyStates.get(signalKey);
    state.count += 1;
    state.mean += (value - state.mean) / state.count;

    state.m += (value - state.mean - delta);
    if (state.m < state.minM) {
      state.minM = state.m;
    }

    const ph = state.m - state.minM;
    return ph > threshold;
  }

  evaluateDrift(signalKey, recentValues, baselineValues) {
    if (!recentValues || recentValues.length < 10) {
      return { driftScore: 0.0, isDriftDetected: false, isChangePoint: false, evidence: ['INSUFFICIENT_WINDOW_SAMPLES'] };
    }

    // Determine scale for histogram
    const maxVal = Math.max(...recentValues, ...(baselineValues || [100]));
    const minVal = Math.min(...recentValues, ...(baselineValues || [0]));

    const hRecent = this.buildHistogram(recentValues, minVal, maxVal);
    const hBaseline = baselineValues && baselineValues.length >= 10
      ? this.buildHistogram(baselineValues, minVal, maxVal)
      : this.buildUniformBaseline(20);

    const jsd = this.calculateJSD(hRecent, hBaseline);
    const lastVal = recentValues[recentValues.length - 1];
    const isChangePoint = this.updatePageHinkley(signalKey, lastVal);

    const evidence = [];
    if (jsd > 0.45) {
      evidence.push('HIGH_DISTRIBUTION_DIVERGENCE_JSD');
    }
    if (isChangePoint) {
      evidence.push('PAGE_HINKLEY_CHANGE_POINT_TRIGGERED');
    }
    if (evidence.length === 0) {
      evidence.push('DISTRIBUTION_STABLE');
    }

    return {
      driftScore: Number(jsd.toFixed(3)),
      isDriftDetected: jsd > 0.45,
      isChangePoint,
      evidence,
    };
  }

  buildUniformBaseline(numBins) {
    return new Array(numBins).fill(1 / numBins);
  }
}

const driftValidator = new DistributionDriftValidator();
module.exports = { driftValidator };
