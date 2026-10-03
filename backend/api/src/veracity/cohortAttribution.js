// Stage 7: Calibrated 4-Way Causal Attribution Engine (Statistical ML)
// Classes: VEHICLE (0) | TELEMETRY (1) | CONTRACT (2) | UNKNOWN (3)

class CohortAttributionEngine {
  constructor() {
    this.classes = ['VEHICLE', 'TELEMETRY', 'CONTRACT', 'UNKNOWN'];

    // Calibrated feature weights [4 x 8] and bias vector [4]
    this.weights = {
      VEHICLE:   [-2.1, -1.8, -2.5, -1.2, -1.4, -0.5,  4.2, -3.5],
      TELEMETRY: [ 3.8,  3.6, -1.5, -0.8,  1.1,  1.8, -2.2,  4.6],
      CONTRACT:  [-1.5, -1.2,  4.5,  3.8,  3.4,  0.2,  1.1, -1.8],
      UNKNOWN:   [-0.8, -0.5, -0.6, -0.4, -0.5, -0.2, -0.7, -0.6],
    };

    this.biases = {
      VEHICLE:   0.25,
      TELEMETRY: 0.15,
      CONTRACT:  0.10,
      UNKNOWN:   0.85,
    };

    this.temperature = 1.85;
  }

  extractFeatures({
    signal,
    observedValue,
    contract = null,
    firmware = '4.6',
    otaCampaign = null,
    crossSignalCoherent = true,
    isPipelineAnomaly = false,
    isPlausible = true,
    recentDriftScore = 0.0,
    isCohortCorrelated = false,
  }) {
    const crossSignalResidual = !crossSignalCoherent ? 0.95 : 0.05;
    const pipelineAnomaly = isPipelineAnomaly ? 1.0 : 0.0;

    // Detect unit-scale flip (0-100% vs 0.0-1.0) or out-of-contract range
    let contractDiffScore = 0.0;
    if (signal === 'battery_soc') {
      if (observedValue >= 0.0 && observedValue <= 1.0 && (!contract || contract.max_value >= 90.0)) {
        contractDiffScore = 0.98;
      } else if (contract && (observedValue < contract.min_value || observedValue > contract.max_value)) {
        contractDiffScore = 0.85;
      }
    }

    const otaCohortMatch = (firmware === '4.7' || isCohortCorrelated || Boolean(otaCampaign)) ? 1.0 : 0.0;
    const driftScore = Math.max(0.0, Math.min(1.0, recentDriftScore || 0.0));
    const freshnessDelayNorm = 0.05;
    const kinematicCoherence = (crossSignalCoherent && isPlausible && !isPipelineAnomaly) ? 1.0 : 0.1;

    let sensorSpikeMagnitude = 0.0;
    if (signal === 'speed_kmh' && (observedValue > 250.0 || observedValue < 0.0)) {
      sensorSpikeMagnitude = Math.min(1.0, (observedValue - 250.0) / 200.0 + 0.5);
    } else if (!isPlausible && !contractDiffScore) {
      sensorSpikeMagnitude = 0.8;
    }

    return [
      crossSignalResidual,
      pipelineAnomaly,
      contractDiffScore,
      otaCohortMatch,
      driftScore,
      freshnessDelayNorm,
      kinematicCoherence,
      sensorSpikeMagnitude,
    ];
  }

  computeLogits(features) {
    const logits = {};
    for (const cls of this.classes) {
      const w = this.weights[cls];
      const b = this.biases[cls];
      let sum = b;
      for (let j = 0; j < features.length; j++) {
        sum += w[j] * features[j];
      }
      logits[cls] = sum;
    }
    return logits;
  }

  computeProbabilities(logits) {
    const T = this.temperature;
    let sumExp = 0.0;
    const expMap = {};

    for (const cls of this.classes) {
      const val = Math.exp(logits[cls] / T);
      expMap[cls] = val;
      sumExp += val;
    }

    const probabilities = {
      vehicle: Number((expMap.VEHICLE / sumExp).toFixed(4)),
      telemetry: Number((expMap.TELEMETRY / sumExp).toFixed(4)),
      contract: Number((expMap.CONTRACT / sumExp).toFixed(4)),
      unknown: Number((expMap.UNKNOWN / sumExp).toFixed(4)),
    };

    return probabilities;
  }

  attributeCause(input) {
    const features = this.extractFeatures(input);
    const logits = this.computeLogits(features);
    const probabilities = this.computeProbabilities(logits);

    // Identify class with highest posterior probability
    let topClass = 'UNKNOWN';
    let maxP = probabilities.unknown;

    for (const [cls, p] of Object.entries(probabilities)) {
      if (p > maxP) {
        maxP = p;
        topClass = cls.toUpperCase();
      }
    }

    // Calibrated decision threshold: if confidence < 0.50, fall back to UNKNOWN
    if (maxP < 0.50) {
      topClass = 'UNKNOWN';
    }

    return {
      topClass,
      probabilities,
      confidence: Number(maxP.toFixed(3)),
      features,
      temperature: this.temperature,
    };
  }

  // Statistical calibration metric: Expected Calibration Error (ECE)
  static computeECE(predictions, numBins = 10) {
    // predictions: Array<{ confidence: number, isCorrect: boolean }>
    if (!predictions || predictions.length === 0) return 0.0;

    const binSize = 1.0 / numBins;
    const bins = Array.from({ length: numBins }, () => ({ count: 0, confSum: 0, correctCount: 0 }));

    for (const pred of predictions) {
      const conf = Math.max(0.0, Math.min(0.9999, pred.confidence));
      const binIdx = Math.floor(conf / binSize);
      bins[binIdx].count++;
      bins[binIdx].confSum += conf;
      if (pred.isCorrect) bins[binIdx].correctCount++;
    }

    let ece = 0.0;
    const totalSamples = predictions.length;

    for (const bin of bins) {
      if (bin.count > 0) {
        const binAcc = bin.correctCount / bin.count;
        const binConf = bin.confSum / bin.count;
        ece += (bin.count / totalSamples) * Math.abs(binAcc - binConf);
      }
    }

    return Number(ece.toFixed(4));
  }
}

const attributionEngine = new CohortAttributionEngine();
module.exports = { attributionEngine, CohortAttributionEngine };
