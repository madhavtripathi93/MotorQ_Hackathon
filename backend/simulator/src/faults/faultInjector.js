// VISTA Chaos Simulator Fault Injector (PDF Section 13)
// Emits both events and ground truth labels for reproducible scientific evaluation

class FaultInjector {
  constructor() {
    this.activeScenario = null;
    this.scenarioId = null;
  }

  setScenario(scenarioName, scenarioId = `scn-${Date.now()}`) {
    this.activeScenario = scenarioName;
    this.scenarioId = scenarioId;
  }

  clearScenario() {
    this.activeScenario = null;
    this.scenarioId = null;
  }

  applyFault(event, vehicleModel) {
    if (!this.activeScenario || this.activeScenario === 'baseline_clean') {
      return [{
        ...event,
        groundTruth: 'CLEAN',
        scenarioId: null,
      }];
    }

    const { signals = {}, provenance = {}, context = {} } = event;
    const isTreatmentCohort = provenance.firmware === '4.7';

    switch (this.activeScenario) {
      case 'sensor_spike': {
        // Speed=400+ km/h sensor glitch defying vehicle kinematics
        const spikedValue = 420.5;
        const updatedContext = { ...context, speed_kmh: spikedValue };
        return [{
          ...event,
          signal: 'speed_kmh',
          value: spikedValue,
          context: updatedContext,
          signals: { ...signals, speedKmh: spikedValue },
          groundTruth: 'SENSOR_CORRUPTION',
          scenarioId: this.scenarioId,
        }];
      }

      case 'pipeline_duplicate': {
        // 1-5% duplicates; duplicate seq preserved
        const original = {
          ...event,
          groundTruth: 'CLEAN',
          scenarioId: this.scenarioId,
        };
        const duplicate = {
          ...event,
          groundTruth: 'PIPELINE_DUPLICATE',
          scenarioId: this.scenarioId,
        };
        return [original, duplicate];
      }

      case 'out_of_order': {
        // Events delayed 1-30 sec
        return [{
          ...event,
          eventTime: new Date(Date.now() - 25000).toISOString(),
          seq: Math.max(1, event.seq - 15),
          groundTruth: 'PIPELINE_REORDER',
          scenarioId: this.scenarioId,
        }];
      }

      case 'silent_drop': {
        // Sequence gap
        return [{
          ...event,
          seq: event.seq + 5, // jumped forward by 5 missing events
          groundTruth: 'PIPELINE_DROP',
          scenarioId: this.scenarioId,
        }];
      }

      case 'gps_spoof': {
        // Position jumps 14-20 km while wheel/odometer stay coherent
        const currentGps = context.gps || (signals.location || { lat: 41.8781, lon: -87.6298 });
        const spoofedGps = {
          lat: Number((currentGps.lat + 0.15).toFixed(6)), // ~16.5 km jump
          lon: Number((currentGps.lon + 0.12).toFixed(6)),
        };
        const updatedContext = { ...context, gps: spoofedGps };
        return [{
          ...event,
          signal: 'location_gps',
          value: spoofedGps,
          context: updatedContext,
          signals: { ...signals, location: spoofedGps },
          groundTruth: 'ADVERSARIAL_GPS',
          scenarioId: this.scenarioId,
        }];
      }

      case 'ota_soc_unit_flip': {
        // SoC 0-100 becomes 0-1 with field still valid JSON in treatment cohort
        if (isTreatmentCohort) {
          const currentSoc = event.value !== undefined && event.signal === 'battery_soc'
            ? event.value
            : (context.battery_soc || signals.batterySocPct || 72.0);
          const flippedVal = Number((currentSoc / 100.0).toFixed(4));
          const updatedContext = { ...context, battery_soc: flippedVal };
          return [{
            ...event,
            signal: 'battery_soc',
            value: flippedVal,
            context: updatedContext,
            signals: { ...signals, batterySocPct: flippedVal },
            groundTruth: 'CONTRACT_SEMANTIC_DRIFT',
            scenarioId: this.scenarioId,
          }];
        }
        return [{ ...event, groundTruth: 'CLEAN', scenarioId: this.scenarioId }];
      }

      case 'ota_sampling_change': {
        // 1 Hz -> 5 Hz without contract version update
        return [{
          ...event,
          groundTruth: 'CONTRACT_SEMANTIC_DRIFT',
          samplingHz: 5.0,
          scenarioId: this.scenarioId,
        }];
      }

      case 'ota_enum_mutation': {
        // HARSH_BRAKE -> HBRAKE in 10% of updated cohort
        if (isTreatmentCohort && Math.random() < 0.10) {
          return [{
            ...event,
            signals: {
              ...signals,
              brakeEvent: 'HBRAKE',
            },
            groundTruth: 'CONTRACT_SEMANTIC_DRIFT',
            scenarioId: this.scenarioId,
          }];
        }
        return [{ ...event, groundTruth: 'CLEAN', scenarioId: this.scenarioId }];
      }

      case 'benign_distribution_shift': {
        // Rush hour speed shift (traffic slows down to 12-25 km/h smoothly)
        const currentSpeed = context.speed_kmh || signals.speedKmh || 55.0;
        const slowedSpeed = Number(Math.max(12.0, currentSpeed * 0.38).toFixed(1));
        const updatedContext = { ...context, speed_kmh: slowedSpeed };
        return [{
          ...event,
          signal: 'speed_kmh',
          value: slowedSpeed,
          context: updatedContext,
          signals: { ...signals, speedKmh: slowedSpeed },
          groundTruth: 'BENIGN_SHIFT',
          scenarioId: this.scenarioId,
        }];
      }

      case 'true_vehicle_event': {
        // Actual emergency braking event consistent across kinematic invariants
        const currentSpeed = context.speed_kmh || signals.speedKmh || 55.0;
        const brakedSpeed = Number(Math.max(0.0, currentSpeed - 35.0).toFixed(1));
        const updatedContext = {
          ...context,
          speed_kmh: brakedSpeed,
          brakePressureBar: 65.0,
          decelerationG: 0.85,
        };
        return [{
          ...event,
          signal: 'speed_kmh',
          value: brakedSpeed,
          context: updatedContext,
          signals: {
            ...signals,
            speedKmh: brakedSpeed,
            brakePressureBar: 65.0,
            decelerationG: 0.85,
          },
          groundTruth: 'REAL_VEHICLE_CHANGE',
          scenarioId: this.scenarioId,
        }];
      }

      default:
        return [{ ...event, groundTruth: 'CLEAN', scenarioId: null }];
    }
  }
}

const faultInjector = new FaultInjector();
module.exports = { faultInjector, FaultInjector };
