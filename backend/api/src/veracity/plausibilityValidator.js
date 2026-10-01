// Stage 3: Plausibility & Physical Invariant Check
const lastPhysicalStateMap = new Map();

function validatePlausibility(event) {
  const { vin, signal, value, eventTime } = event;
  const evidence = [];
  let plausibilityScore = 1.0;
  const currentTs = new Date(eventTime || Date.now()).getTime();

  const stateKey = `${vin}:${signal}`;
  const prevState = lastPhysicalStateMap.get(stateKey);

  if (signal === 'speed_kmh') {
    if (value > 250.0 || value < 0.0) {
      evidence.push('PHYSICALLY_IMPOSSIBLE_SPEED');
      plausibilityScore = 0.05;
    } else if (prevState) {
      const dtSec = Math.max(0.1, (currentTs - prevState.ts) / 1000);
      const accelKmhPerSec = Math.abs(value - prevState.val) / dtSec;
      // 1g is ~35.3 km/h/s. Vehicles cannot exceed 1.5g (~53 km/h/s) without a catastrophic collision.
      if (accelKmhPerSec > 60.0) {
        evidence.push('EXCESSIVE_ACCELERATION_SPIKE');
        plausibilityScore = 0.15;
      } else {
        evidence.push('PLAUSIBLE_KINEMATICS');
      }
    } else {
      evidence.push('PLAUSIBLE_BOUNDS');
    }
  } else if (signal === 'battery_soc') {
    if (value < 0.0 || (value > 1.0 && value > 100.0)) {
      evidence.push('OUT_OF_BOUNDS_SOC');
      plausibilityScore = 0.05;
    } else if (prevState) {
      const dtSec = Math.max(0.1, (currentTs - prevState.ts) / 1000);
      const ratePerSec = Math.abs(value - prevState.val) / dtSec;
      // Normal battery discharge is < 0.5% per sec. >20 pp/sec is corruption or unit scaling flip.
      if (ratePerSec > 20.0) {
        evidence.push('SOC_RATE_OF_CHANGE_ANOMALY');
        plausibilityScore = 0.1;
      } else {
        evidence.push('PLAUSIBLE_SOC_RATE');
      }
    } else {
      evidence.push('PLAUSIBLE_SOC');
    }
  } else if (signal === 'location_gps') {
    if (prevState && value && prevState.val) {
      const dtSec = Math.max(0.1, (currentTs - prevState.ts) / 1000);
      // Rough distance between lat/lon
      const dLat = (value.lat - prevState.val.lat) * 111.0;
      const dLon = (value.lon - prevState.val.lon) * 111.0 * Math.cos(value.lat * Math.PI / 180);
      const distKm = Math.sqrt(dLat * dLat + dLon * dLon);
      const speedKmH = (distKm / dtSec) * 3600;

      if (distKm > 2.0 && speedKmH > 350.0) {
        evidence.push('TELEPORTATION_GPS_JUMP');
        plausibilityScore = 0.05;
      } else {
        evidence.push('PLAUSIBLE_TRAJECTORY');
      }
    } else {
      evidence.push('PLAUSIBLE_COORDINATES');
    }
  }

  // Update physical state
  lastPhysicalStateMap.set(stateKey, { val: value, ts: currentTs });

  return {
    plausibilityScore,
    evidence,
    isPlausible: plausibilityScore >= 0.5,
  };
}

module.exports = { validatePlausibility };
