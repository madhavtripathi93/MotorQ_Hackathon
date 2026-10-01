// Stage 4: Freshness SLA & Exponential Age Decay Check

const SIGNAL_SLAS_SEC = {
  speed_kmh: 3.0,
  location_gps: 5.0,
  battery_soc: 30.0,
  odometer_km: 60.0,
  default: 10.0,
};

function validateFreshness(event) {
  const { signal, eventTime } = event;
  const now = Date.now();
  const eventTs = new Date(eventTime || now).getTime();
  const ageSec = Math.max(0, (now - eventTs) / 1000);

  const slaSec = SIGNAL_SLAS_SEC[signal] || SIGNAL_SLAS_SEC.default;
  const evidence = [];

  // Exponential decay: e^(-age / (2 * sla))
  const decayConstant = 1 / (2 * slaSec);
  const freshnessScore = Math.max(0.01, Math.min(1.0, Math.exp(-decayConstant * ageSec)));

  if (ageSec <= slaSec) {
    evidence.push('FRESH');
  } else if (ageSec <= slaSec * 3) {
    evidence.push('STALE_WITHIN_RECOVERY_WINDOW');
  } else {
    evidence.push('EXPIRED_SLA_LATENCY');
  }

  return {
    freshnessScore: Number(freshnessScore.toFixed(3)),
    ageSec: Number(ageSec.toFixed(2)),
    slaSec,
    evidence,
  };
}

module.exports = { validateFreshness };
