// Stage 5: Cross-Signal Invariant Validation
// Validates physical coherence across independent sensors: GPS vs Wheel Speed vs Odometer

const vehicleKinematicStateMap = new Map();

function validateCrossSignal(canonicalEvent) {
  const { signals = {}, context = {}, vin, eventTime } = canonicalEvent;
  const evidence = [];
  let consistencyScore = 1.0;

  // Resolve location, speed, odometer from canonical event or context
  let location = null;
  if (canonicalEvent.signal === 'location_gps' && typeof canonicalEvent.value === 'object') {
    location = canonicalEvent.value;
  } else if (context.gps) {
    location = context.gps;
  } else if (signals.location) {
    location = signals.location;
  }

  let speedKmh = null;
  if (canonicalEvent.signal === 'speed_kmh' && typeof canonicalEvent.value === 'number') {
    speedKmh = canonicalEvent.value;
  } else if (context.speed_kmh !== undefined) {
    speedKmh = context.speed_kmh;
  } else if (signals.speedKmh !== undefined) {
    speedKmh = signals.speedKmh;
  }

  let odometerKm = null;
  if (context.odometer_km !== undefined) {
    odometerKm = context.odometer_km;
  } else if (signals.odometerKm !== undefined) {
    odometerKm = signals.odometerKm;
  }

  // Prior state from explicit parameter or in-memory kinematic tracker
  const prior = signals.previousSignals || (vin ? vehicleKinematicStateMap.get(vin) : null);

  if (location && prior && prior.location) {
    const prevTs = prior.eventTime ? new Date(prior.eventTime).getTime() : Date.now() - 1000;
    const currTs = eventTime ? new Date(eventTime).getTime() : Date.now();
    const dtSec = Math.max(0.1, (currTs - prevTs) / 1000);

    // Compute GPS displacement in km using Haversine approximation
    const dLat = (location.lat - prior.location.lat) * 111.0;
    const dLon = (location.lon - prior.location.lon) * 111.0 * Math.cos(location.lat * Math.PI / 180);
    const gpsDistanceKm = Math.sqrt(dLat * dLat + dLon * dLon);

    // Compute expected distance from wheel speed integral: distance = avg_speed * dt
    const avgSpeed = speedKmh !== null ? speedKmh : (prior.speedKmh || 0);
    const speedExpectedDistKm = (avgSpeed / 3600) * dtSec;

    // Compute odometer delta
    const odoDeltaKm = (odometerKm !== null && prior.odometerKm !== null)
      ? Math.max(0, odometerKm - prior.odometerKm)
      : null;

    // Check discrepancy between GPS and Wheel/Odometer
    if (gpsDistanceKm > 1.0) { // Significant GPS movement (>1 km in dtSec)
      const discrepancyWithSpeed = Math.abs(gpsDistanceKm - speedExpectedDistKm);
      const isOdoCoherentWithSpeed = odoDeltaKm !== null ? Math.abs(odoDeltaKm - speedExpectedDistKm) < 0.05 : true;

      if (discrepancyWithSpeed > 2.0 && isOdoCoherentWithSpeed) {
        // Position jump 5-20 km, but wheel speed and odometer confirm vehicle moved only ~10-50m
        evidence.push('GPS_SPOOF_INCONSISTENCY');
        evidence.push('ODOMETER_DELTA_MATCH');
        evidence.push('WHEEL_SPEED_MATCH');
        consistencyScore = 0.08;
      } else if (discrepancyWithSpeed < 0.2) {
        evidence.push('GPS_SPEED_MATCH');
        evidence.push('ODOMETER_DELTA_MATCH');
        consistencyScore = 0.98;
      } else {
        evidence.push('MODERATE_KINEMATIC_RESIDUAL');
        consistencyScore = 0.75;
      }
    } else {
      evidence.push('STATIONARY_OR_MICRO_MOVEMENT');
      evidence.push('CROSS_SIGNAL_BASELINE');
    }
  } else {
    evidence.push('CROSS_SIGNAL_BASELINE');
  }

  // Cross-check battery SoC vs speed/regen
  const currentSoc = canonicalEvent.signal === 'battery_soc' ? canonicalEvent.value : (context.battery_soc || signals.batterySocPct);
  if (prior && prior.batterySoc !== undefined && currentSoc !== undefined) {
    const dSoc = currentSoc - prior.batterySoc;
    if (dSoc > 0.5 && (speedKmh || 0) > 10) {
      evidence.push('ANOMALOUS_SOC_INCREASE_WHILE_DRIVING');
      consistencyScore = Math.min(consistencyScore, 0.4);
    }
  }

  // Update in-memory state for this VIN
  if (vin) {
    vehicleKinematicStateMap.set(vin, {
      location: location || (prior ? prior.location : null),
      speedKmh: speedKmh !== null ? speedKmh : (prior ? prior.speedKmh : 0),
      odometerKm: odometerKm !== null ? odometerKm : (prior ? prior.odometerKm : 0),
      batterySoc: currentSoc,
      eventTime: eventTime || new Date().toISOString(),
    });
  }

  return {
    consistencyScore: Number(consistencyScore.toFixed(3)),
    evidence,
    isCoherent: consistencyScore >= 0.5,
  };
}

module.exports = { validateCrossSignal };
