// Stage 9: Deterministic Policy Decision Gate
// Evaluates actions against explicit trust thresholds and evidence completeness rules

const ACTION_POLICIES = {
  dispatch_recovery: {
    name: 'Dispatch Physical Recovery Towing',
    signalKey: 'location_gps',
    minTrustThreshold: 0.85,
    requiredEvidence: ['PLAUSIBLE_TRAJECTORY', 'CROSS_SIGNAL_BASELINE'],
    criticalForbiddenEvidence: ['GPS_SPOOF_INCONSISTENCY', 'TELEPORTATION_GPS_JUMP'],
  },
  recalibrate_range: {
    name: 'Dynamic EV Range Estimation',
    signalKey: 'battery_soc',
    minTrustThreshold: 0.80,
    requiredEvidence: ['IN_RANGE'],
    criticalForbiddenEvidence: ['VALUE_BELOW_CONTRACT_MIN', 'CONTRACT_SEMANTIC_DRIFT'],
  },
  driver_penalty_point: {
    name: 'Driver Harsh Braking Penalty / Insurance Assessment',
    signalKey: 'speed_kmh',
    minTrustThreshold: 0.90,
    requiredEvidence: ['PLAUSIBLE_KINEMATICS'],
    criticalForbiddenEvidence: ['PHYSICALLY_IMPOSSIBLE_SPEED', 'EXCESSIVE_ACCELERATION_SPIKE'],
  },
  high_voltage_isolation: {
    name: 'High Voltage Emergency Battery Contactor Trip',
    signalKey: 'battery_soc',
    minTrustThreshold: 0.95,
    requiredEvidence: ['PLAUSIBLE_SOC_RATE'],
    criticalForbiddenEvidence: ['SOC_RATE_OF_CHANGE_ANOMALY'],
  },
  automated_charge_schedule: {
    name: 'Grid Overnight Charge Optimization',
    signalKey: 'battery_soc',
    minTrustThreshold: 0.75,
    requiredEvidence: ['FRESH'],
    criticalForbiddenEvidence: ['VALUE_BELOW_CONTRACT_MIN'],
  },
};

function evaluatePolicyDecision({
  requestedAction,
  signalKey = 'speed_kmh',
  trustScore,
  evidence = [],
  actor = 'system',
}) {
  const policy = ACTION_POLICIES[requestedAction];

  if (!policy) {
    return {
      outcome: 'BLOCK',
      policyCode: 'ACTION_NOT_IN_ALLOW_LIST',
      reason: `Action '${requestedAction}' is not a registered policy-governed action.`,
      trustThreshold: 1.0,
      actualTrust: trustScore,
    };
  }

  // Fail closed if trustScore is missing or invalid
  if (trustScore === undefined || trustScore === null || isNaN(trustScore)) {
    return {
      outcome: 'BLOCK',
      policyCode: 'NO_TRUST_TELEMETRY',
      reason: `Action '${requestedAction}' blocked: no decision-grade telemetry trust record available. Failing closed.`,
      trustThreshold: policy.minTrustThreshold,
      actualTrust: 0.0,
    };
  }

  // Check critical forbidden evidence (e.g. spoofing or unit flip)
  for (const forbidden of policy.criticalForbiddenEvidence) {
    if (evidence.includes(forbidden)) {
      return {
        outcome: 'BLOCK',
        policyCode: 'FORBIDDEN_EVIDENCE_DETECTED',
        reason: `Action '${requestedAction}' blocked due to conflicting evidence: ${forbidden}`,
        trustThreshold: policy.minTrustThreshold,
        actualTrust: trustScore,
        violatingEvidence: forbidden,
      };
    }
  }

  // Enforce required evidence completeness before ALLOW
  if (policy.requiredEvidence && policy.requiredEvidence.length > 0) {
    const missingEvidence = policy.requiredEvidence.filter((req) => !evidence.includes(req));
    if (missingEvidence.length > 0) {
      return {
        outcome: 'BLOCK',
        policyCode: 'MISSING_REQUIRED_EVIDENCE',
        reason: `Action '${requestedAction}' blocked: missing required evidence tag(s): ${missingEvidence.join(', ')}`,
        trustThreshold: policy.minTrustThreshold,
        actualTrust: trustScore,
        missingEvidence,
      };
    }
  }

  // Check numerical trust threshold
  if (trustScore < policy.minTrustThreshold) {
    // If within 0.15 of threshold and no forbidden evidence, mark for manual operator REVIEW
    if (trustScore >= policy.minTrustThreshold - 0.15) {
      return {
        outcome: 'REVIEW',
        policyCode: 'BORDERLINE_TRUST_OPERATOR_REVIEW',
        reason: `Trust score (${trustScore}) is borderline below required threshold (${policy.minTrustThreshold}). Requires human confirmation.`,
        trustThreshold: policy.minTrustThreshold,
        actualTrust: trustScore,
      };
    }

    return {
      outcome: 'BLOCK',
      policyCode: 'INSUFFICIENT_SIGNAL_TRUST',
      reason: `Telemetry trust (${trustScore}) does not meet decision-grade threshold (${policy.minTrustThreshold}) for ${policy.name}.`,
      trustThreshold: policy.minTrustThreshold,
      actualTrust: trustScore,
    };
  }

  // Passed all criteria
  return {
    outcome: 'ALLOW',
    policyCode: 'POLICY_SATISFIED',
    reason: `Telemetry trust (${trustScore}) satisfies threshold (${policy.minTrustThreshold}) with verified required evidence.`,
    trustThreshold: policy.minTrustThreshold,
    actualTrust: trustScore,
  };
}

module.exports = {
  ACTION_POLICIES,
  evaluatePolicyDecision,
};
