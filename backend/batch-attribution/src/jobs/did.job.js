// Difference-in-Differences (DiD) Estimation Job (PDF Section 19 & 20)
// DiD = (Y_post_treat - Y_pre_treat) - (Y_post_control - Y_pre_control)

function estimateDifferenceInDifferences({
  treatmentPreValues,
  treatmentPostValues,
  controlPreValues,
  controlPostValues,
}) {
  // Require sufficient observations in pre and post periods
  if (
    !Array.isArray(treatmentPreValues) || treatmentPreValues.length < 2 ||
    !Array.isArray(treatmentPostValues) || treatmentPostValues.length < 2 ||
    !Array.isArray(controlPreValues) || controlPreValues.length < 2 ||
    !Array.isArray(controlPostValues) || controlPostValues.length < 2
  ) {
    const err = new Error('INSUFFICIENT_DATA: Treatment and control cohorts must contain at least 2 observations in both pre and post periods.');
    err.code = 'INSUFFICIENT_DATA';
    throw err;
  }

  const mean = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  const std = (arr, m) => {
    if (arr.length <= 1) return 1.0;
    const v = arr.reduce((acc, x) => acc + Math.pow(x - m, 2), 0) / (arr.length - 1);
    return Math.sqrt(v);
  };

  const yPreTreat = mean(treatmentPreValues);
  const yPostTreat = mean(treatmentPostValues);
  const yPreControl = mean(controlPreValues);
  const yPostControl = mean(controlPostValues);

  const diffTreat = yPostTreat - yPreTreat;
  const diffControl = yPostControl - yPreControl;
  const didEstimate = diffTreat - diffControl;

  // Standard error and 95% Confidence Interval
  const seTreat = std(treatmentPostValues, yPostTreat) / Math.sqrt(treatmentPostValues.length || 1);
  const seControl = std(controlPostValues, yPostControl) / Math.sqrt(controlPostValues.length || 1);
  const pooledSE = Math.sqrt(Math.pow(seTreat, 2) + Math.pow(seControl, 2)) || 0.15;
  const ciLow = didEstimate - 1.96 * pooledSE;
  const ciHigh = didEstimate + 1.96 * pooledSE;

  // T-statistic & P-value approximation
  const tStat = Math.abs(didEstimate / (pooledSE || 1));
  const isSignificant = tStat > 2.576; // p < 0.01

  return {
    did: Number(didEstimate.toFixed(4)),
    yPreTreat: Number(yPreTreat.toFixed(3)),
    yPostTreat: Number(yPostTreat.toFixed(3)),
    yPreControl: Number(yPreControl.toFixed(3)),
    yPostControl: Number(yPostControl.toFixed(3)),
    diffTreatment: Number(diffTreat.toFixed(3)),
    diffControl: Number(diffControl.toFixed(3)),
    confidenceInterval: [Number(ciLow.toFixed(4)), Number(ciHigh.toFixed(4))],
    standardError: Number(pooledSE.toFixed(4)),
    tStatistic: Number(tStat.toFixed(3)),
    isStatisticallySignificant: isSignificant,
  };
}

module.exports = { estimateDifferenceInDifferences };
