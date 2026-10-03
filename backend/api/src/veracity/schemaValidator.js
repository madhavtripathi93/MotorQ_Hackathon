// Stage 1: Schema & Range Invariant Check
function validateSchema(rawEvent, contract) {
  const evidence = [];
  const errors = [];

  if (!rawEvent.vin || typeof rawEvent.vin !== 'string') {
    errors.push('MISSING_OR_INVALID_VIN');
  }

  if (rawEvent.seq === undefined || typeof rawEvent.seq !== 'number') {
    errors.push('MISSING_OR_INVALID_SEQUENCE');
  }

  if (!rawEvent.eventTime) {
    errors.push('MISSING_EVENT_TIME');
  }

  if (!contract) {
    // If no contract registered, mark unknown contract version
    return {
      isValid: errors.length === 0,
      evidence: ['NO_EXPLICIT_CONTRACT_REGISTERED'],
      errors,
      inContractRange: true,
    };
  }

  evidence.push(`CONTRACT_VERSION_${contract.semantic_version || 'v1'}`);

  // Value range verification
  const val = rawEvent.value;
  if (typeof val === 'number') {
    if (contract.min_value !== undefined && val < contract.min_value) {
      evidence.push('VALUE_BELOW_CONTRACT_MIN');
    } else if (contract.max_value !== undefined && val > contract.max_value) {
      evidence.push('VALUE_ABOVE_CONTRACT_MAX');
    } else {
      evidence.push('IN_RANGE');
    }
  }

  const isValid = errors.length === 0 && !evidence.includes('VALUE_BELOW_CONTRACT_MIN') && !evidence.includes('VALUE_ABOVE_CONTRACT_MAX');

  return {
    isValid,
    evidence,
    errors,
    inContractRange: !evidence.includes('VALUE_BELOW_CONTRACT_MIN') && !evidence.includes('VALUE_ABOVE_CONTRACT_MAX'),
  };
}

module.exports = { validateSchema };
