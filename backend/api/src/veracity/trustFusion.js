// Stage 8: Trust Fusion & Calibration Engine

function fuseTrustEvidence({
  schemaResult,
  sequenceResult,
  plausibilityResult,
  freshnessResult,
  crossSignalResult,
  driftResult,
  attributionResult,
}) {
  const evidence = [
    ...(schemaResult.evidence || []),
    ...(sequenceResult.evidence || []),
    ...(plausibilityResult.evidence || []),
    ...(freshnessResult.evidence || []),
    ...(crossSignalResult.evidence || []),
    ...(driftResult.evidence || []),
  ];

  // Component weights based on empirical validation
  const wSchema = 0.20;
  const wSequence = 0.15;
  const wPlausibility = 0.25;
  const wFreshness = 0.15;
  const wCrossSignal = 0.25;

  const scoreSchema = schemaResult.isValid ? 1.0 : 0.0;
  const scoreSequence = sequenceResult.integrityScore !== undefined ? sequenceResult.integrityScore : 1.0;
  const scorePlausibility = plausibilityResult.plausibilityScore !== undefined ? plausibilityResult.plausibilityScore : 1.0;
  const scoreFreshness = freshnessResult.freshnessScore !== undefined ? freshnessResult.freshnessScore : 1.0;
  const scoreCrossSignal = crossSignalResult.consistencyScore !== undefined ? crossSignalResult.consistencyScore : 1.0;

  // Multiplicative penalty for fatal contradictions (e.g. duplicate or out of range)
  let rawTrust = (
    scoreSchema * wSchema +
    scoreSequence * wSequence +
    scorePlausibility * wPlausibility +
    scoreFreshness * wFreshness +
    scoreCrossSignal * wCrossSignal
  );

  // If severe contract unit flip or GPS spoof occurs, apply non-linear suppression
  if (attributionResult.topClass === 'CONTRACT') {
    rawTrust = Math.min(rawTrust, 0.12);
  } else if (evidence.includes('GPS_SPOOF_INCONSISTENCY') || evidence.includes('PHYSICALLY_IMPOSSIBLE_SPEED')) {
    rawTrust = Math.min(rawTrust, 0.08);
  } else if (sequenceResult.isDuplicate) {
    rawTrust = 0.0;
  }

  // Derive explicit reason codes for decision engine & UI
  const reasonCodes = [];
  if (scoreFreshness > 0.8) reasonCodes.push('FRESH');
  if (scoreSchema === 1.0 && plausibilityResult.isPlausible) reasonCodes.push('IN_RANGE');
  if (scoreCrossSignal > 0.9) reasonCodes.push('CROSS_SIGNAL_COHERENT');
  if (attributionResult.topClass === 'CONTRACT') reasonCodes.push('CONTRACT_SEMANTIC_DRIFT');
  if (evidence.includes('GPS_SPOOF_INCONSISTENCY')) reasonCodes.push('ADVERSARIAL_GPS_SUSPECTED');
  if (sequenceResult.isDuplicate) reasonCodes.push('DUPLICATE_DISCARDED');
  if (reasonCodes.length === 0) reasonCodes.push('STANDARD_VERIFIED');

  const finalTrust = Number(Math.max(0.0, Math.min(1.0, rawTrust)).toFixed(2));
  const finalConfidence = Number(attributionResult.confidence.toFixed(2));

  return {
    trust: finalTrust,
    confidence: finalConfidence,
    classProbabilities: attributionResult.probabilities,
    topClass: attributionResult.topClass,
    evidence,
    reasonCodes,
  };
}

module.exports = { fuseTrustEvidence };
