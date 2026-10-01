// Placebo Date Test (PDF Section 19)
// Tests DiD on fictitious pre-intervention windows to verify that treatment and control were tracking identically

const { estimateDifferenceInDifferences } = require('./did.job');

function runPlaceboTest({
  treatmentPreValues = [72.5, 71.8, 73.0, 72.1],
  controlPreValues = [71.9, 72.4, 71.5, 72.2],
}) {
  // Split pre-period into pseudo-pre and pseudo-post
  const midTreat = Math.floor(treatmentPreValues.length / 2);
  const midControl = Math.floor(controlPreValues.length / 2);

  const pseudoPreTreat = treatmentPreValues.slice(0, midTreat);
  const pseudoPostTreat = treatmentPreValues.slice(midTreat);
  const pseudoPreControl = controlPreValues.slice(0, midControl);
  const pseudoPostControl = controlPreValues.slice(midControl);

  const placeboResult = estimateDifferenceInDifferences({
    treatmentPreValues: pseudoPreTreat,
    treatmentPostValues: pseudoPostTreat,
    controlPreValues: pseudoPreControl,
    controlPostValues: pseudoPostControl,
  });

  const passed = Math.abs(placeboResult.did) < 0.5 && !placeboResult.isStatisticallySignificant;

  return {
    placeboDid: placeboResult.did,
    passed,
    interpretation: passed
      ? 'PASS: Placebo test confirms no pre-existing divergent shock before OTA release'
      : 'FAIL: Spurious divergence detected in placebo pre-window',
  };
}

module.exports = { runPlaceboTest };
