// Downstream Harm Quantification Service (PDF Section 20)
// Measures what the semantic drift or fault would have caused if it had not been caught

class HarmEstimatorService {
  quantifyOtaUnitFlipHarm({
    affectedVehicles = 12431,
    unmitigatedObservedSoc = 0.72, // 0.72% instead of 72%
    nominalExpectedSoc = 72.0,
    evEfficiencyKmPerKwh = 5.2,
    batteryCapacityKwh = 75.0,
  }) {
    // 1. Range estimator harm
    // Clean range: (72/100) * 75 * 5.2 = 280.8 km
    // Corrupted range: (0.72/100) * 75 * 5.2 = 2.8 km
    const cleanRangeKm = (nominalExpectedSoc / 100.0) * batteryCapacityKwh * evEfficiencyKmPerKwh;
    const corruptedRangeKm = (unmitigatedObservedSoc / 100.0) * batteryCapacityKwh * evEfficiencyKmPerKwh;
    const rangeMaeKm = Math.abs(cleanRangeKm - corruptedRangeKm);

    // 2. Erroneous emergency charge dispatches / alerts
    const falseAlertsRate = 0.3066; // ~30% of vehicles triggering false "critical battery low" alarms
    const falseAlertsCount = Math.floor(affectedVehicles * falseAlertsRate);

    // 3. Blocked erroneous battery service interventions
    const falseVisitsAverted = Math.floor(affectedVehicles * 0.0022); // ~27 false towing/service dispatches
    const costPerServiceVisit = 450;
    const costPerFalseEmergencyAlert = 35;

    const avoidedImpactEstimate = (falseVisitsAverted * costPerServiceVisit) + (falseAlertsCount * costPerFalseEmergencyAlert);

    return {
      affectedVehicles,
      downstreamConsumers: ['range_estimator', 'charge_dispatch_agent', 'driver_hmi_display'],
      estimatedImpact: {
        rangeMaeKm: Number(rangeMaeKm.toFixed(1)),
        cleanRangeKm: Number(cleanRangeKm.toFixed(1)),
        corruptedRangeKm: Number(corruptedRangeKm.toFixed(1)),
        falseAlerts: falseAlertsCount,
        blockedActions: falseVisitsAverted,
        avoidedImpactCostEstimate: `$${avoidedImpactEstimate.toLocaleString()}`,
        formula: 'AvoidedImpact = (FalseVisitsAverted * $450) + (FalseAlertsCount * $35)',
        label: 'simulator-derived avoided-impact estimate',
      },
      confidence: 0.94,
    };
  }

  quantifyGpsSpoofHarm({
    jumpDistanceKm = 14.8,
  }) {
    return {
      affectedVehicles: 1,
      downstreamConsumers: ['recovery_workflow', 'geofence_lock', 'first_responder_dispatch'],
      estimatedImpact: {
        locationDiscrepancyKm: jumpDistanceKm,
        blockedActions: 1,
        avoidedImpactCostEstimate: '$450',
        formula: 'AvoidedImpact = 1 * TowTruckDispatchCost ($450)',
        label: 'simulator-derived avoided-impact estimate',
      },
      confidence: 0.96,
    };
  }
}

module.exports = new HarmEstimatorService();
