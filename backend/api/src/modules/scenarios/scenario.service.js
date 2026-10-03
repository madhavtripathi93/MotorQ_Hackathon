const crypto = require('crypto');
const { publish } = require('../../shared/kafka/producer');
const logger = require('../../shared/logger');
const incidentRepo = require('../incidents/incident.repository');
const incidentService = require('../incidents/incident.service');

const KNOWN_SCENARIOS = {
  baseline_clean: {
    groundTruth: 'CLEAN',
    description: '100K VINs; 1 Hz baseline telemetry with <1% network jitter',
  },
  sensor_spike: {
    groundTruth: 'SENSOR_CORRUPTION',
    description: 'Speed spike to 400 km/h or SoC instantaneous drop >20 pp/sec',
  },
  pipeline_duplicate: {
    groundTruth: 'PIPELINE_DUPLICATE',
    description: '1-5% duplicates replayed with sequence numbers preserved',
  },
  out_of_order: {
    groundTruth: 'PIPELINE_REORDER',
    description: '5-15% events delayed by 1-30 seconds',
  },
  silent_drop: {
    groundTruth: 'PIPELINE_DROP',
    description: '0.1-1% network event loss creating sequence gaps',
  },
  gps_spoof: {
    groundTruth: 'ADVERSARIAL_GPS',
    description: 'GPS coordinates jump 3-20 km while wheel and odometer remain coherent',
  },
  ota_soc_unit_flip: {
    groundTruth: 'CONTRACT_SEMANTIC_DRIFT',
    description: 'SoC 0-100 scale compressed to 0.0-1.0 in firmware 4.7 cohort without contract update',
  },
  ota_sampling_change: {
    groundTruth: 'CONTRACT_SEMANTIC_DRIFT',
    description: 'Telemetry sampling rate elevated from 1 Hz to 5 Hz unannounced',
  },
  ota_enum_mutation: {
    groundTruth: 'CONTRACT_SEMANTIC_DRIFT',
    description: 'HARSH_BRAKE mutated to HBRAKE in 10% updated cohort',
  },
  benign_distribution_shift: {
    groundTruth: 'BENIGN_SHIFT',
    description: 'Rush-hour speed distribution shifts down, contracts unchanged',
  },
  true_vehicle_event: {
    groundTruth: 'REAL_VEHICLE_CHANGE',
    description: 'Actual heavy braking/discharge event consistent across wheel speed, regen, and deceleration',
  },
};

// ponytail: Maps scenario → incident generation parameters so we don't repeat switch/case
const SCENARIO_INCIDENT_CONFIG = {
  ota_soc_unit_flip: { signal: 'battery_soc', cause: 'CONTRACT', severity: 'CRITICAL', trust: 0.12, confidence: 0.69, affectedPct: 0.25 },
  sensor_spike: { signal: 'speed_kmh', cause: 'TELEMETRY', severity: 'CRITICAL', trust: 0.08, confidence: 0.94, affectedPct: 0.15 },
  gps_spoof: { signal: 'location_gps', cause: 'TELEMETRY', severity: 'CRITICAL', trust: 0.08, confidence: 0.96, affectedPct: 0.10 },
  pipeline_duplicate: { signal: 'battery_soc', cause: 'PIPELINE', severity: 'HIGH', trust: 0.35, confidence: 0.85, affectedPct: 0.05 },
  out_of_order: { signal: 'battery_soc', cause: 'PIPELINE', severity: 'HIGH', trust: 0.40, confidence: 0.80, affectedPct: 0.10 },
  silent_drop: { signal: 'battery_soc', cause: 'PIPELINE', severity: 'HIGH', trust: 0.30, confidence: 0.82, affectedPct: 0.05 },
  ota_sampling_change: { signal: 'battery_soc', cause: 'CONTRACT', severity: 'HIGH', trust: 0.25, confidence: 0.75, affectedPct: 0.20 },
  ota_enum_mutation: { signal: 'speed_kmh', cause: 'CONTRACT', severity: 'HIGH', trust: 0.30, confidence: 0.70, affectedPct: 0.10 },
  benign_distribution_shift: { signal: 'speed_kmh', cause: 'BENIGN', severity: 'MEDIUM', trust: 0.55, confidence: 0.60, affectedPct: 0.30 },
  true_vehicle_event: { signal: 'speed_kmh', cause: 'REAL_EVENT', severity: 'MEDIUM', trust: 0.65, confidence: 0.90, affectedPct: 0.02 },
};

const db = require('../../shared/db');

class ScenarioService {
  constructor() {
    if (!db.inMemoryStore.scenarios) {
      db.inMemoryStore.scenarios = new Map();
    }
  }

  get activeScenarios() {
    if (!db.inMemoryStore.scenarios) db.inMemoryStore.scenarios = new Map();
    return db.inMemoryStore.scenarios;
  }

  getAvailableScenarios() {
    return Object.entries(KNOWN_SCENARIOS).map(([id, info]) => ({
      scenario: id,
      ...info,
    }));
  }

  getActiveScenarios() {
    return Array.from(this.activeScenarios.values());
  }

  async startScenario({ scenario, cohort = { firmware: '4.7', percentage: 12 }, durationSeconds = 120, tenantId = 'tenant-default' }) {
    const meta = KNOWN_SCENARIOS[scenario];
    if (!meta) {
      const err = new Error(`Unknown scenario '${scenario}'. Must be one of: ${Object.keys(KNOWN_SCENARIOS).join(', ')}`);
      err.statusCode = 400;
      err.code = 'INVALID_SCENARIO';
      throw err;
    }

    const scenarioId = `scn-${Math.floor(10000 + Math.random() * 90000)}`;
    const startedAt = new Date().toISOString();

    const scenarioRecord = {
      scenarioId,
      scenario,
      groundTruth: meta.groundTruth,
      description: meta.description,
      cohort,
      durationSeconds,
      status: 'RUNNING',
      startedAt,
      tenantId,
    };

    this.activeScenarios.set(scenarioId, scenarioRecord);

    // 0. Clear old incidents for a fresh demo run
    await incidentRepo.clearTenantIncidents(tenantId).catch(err => {
      logger.error({ err, tenantId }, 'Failed to clear previous incidents on scenario start');
    });

    // 1. Publish scenario state to event bus for streaming workers & UI
    await publish('incidents.v1', scenarioId, {
      type: 'SCENARIO_STARTED',
      tenant_id: tenantId,
      ...scenarioRecord,
    });

    // 2. Directly generate incidents + trust degradation for the requesting tenant's vehicles
    this._generateTenantIncidents(scenario, tenantId, scenarioId).catch(err => {
      logger.error({ err: err.message, scenarioId }, 'Failed to generate tenant incidents for scenario');
    });

    logger.info({ scenarioId, scenario, groundTruth: meta.groundTruth, tenantId }, 'Chaos simulator scenario started and active in data path');

    // Auto-stop timer
    setTimeout(() => {
      if (this.activeScenarios.has(scenarioId)) {
        this.stopScenario(scenarioId).catch(() => {});
      }
    }, durationSeconds * 1000);

    return scenarioRecord;
  }

  /**
   * Generates incidents and trust-update WebSocket events for the requesting tenant's
   * actual vehicles. This ensures scenarios produce visible effects regardless of which
   * tenant is logged in (not just tenant-default which the background simulator targets).
   */
  async _generateTenantIncidents(scenario, tenantId, scenarioId) {
    const config = SCENARIO_INCIDENT_CONFIG[scenario];
    if (!config) return; // baseline_clean → no incidents

    // Get this tenant's vehicles
    const tenantVehicles = Array.from(db.inMemoryStore.vehicles.values())
      .filter(v => v.tenant_id === tenantId);

    if (tenantVehicles.length === 0) return;

    // Affect a subset of vehicles based on scenario config
    const affectedCount = Math.max(1, Math.floor(tenantVehicles.length * config.affectedPct));
    const shuffled = tenantVehicles.sort(() => Math.random() - 0.5);
    const affected = shuffled.slice(0, affectedCount);

    for (const vehicle of affected) {
      // Small jitter in trust scores for realism
      const trustJitter = (Math.random() - 0.5) * 0.06;
      const trustScore = Math.max(0.01, Math.min(0.99, config.trust + trustJitter));

      // Create incident
      try {
        await incidentService.recordIncident({
          tenantId,
          vin: vehicle.vin,
          signalName: config.signal,
          status: 'OPEN',
          severity: config.severity,
          causeAttribution: config.cause,
          trustScore: Number(trustScore.toFixed(4)),
          confidence: config.confidence,
          evidenceList: [{
            code: `SCENARIO_${scenario.toUpperCase()}`,
            description: `Injected by chaos scenario ${scenario} (${scenarioId})`,
            payload: { scenarioId, groundTruth: KNOWN_SCENARIOS[scenario].groundTruth },
          }],
        });
      } catch (err) {
        logger.warn({ err: err.message, vin: vehicle.vin }, 'Failed to create scenario incident');
      }

      // Emit trust degradation via WebSocket so the fleet map updates in real-time
      await publish('telemetry.veracity.v1', vehicle.vin, {
        vin: vehicle.vin,
        tenant_id: tenantId,
        signal: config.signal,
        trust: trustScore,
        confidence: config.confidence,
        topClass: config.cause,
        scenarioId,
      }).catch(() => {});
    }

    logger.info({ tenantId, scenario, affectedCount, total: tenantVehicles.length }, 'Generated scenario incidents for tenant vehicles');
  }

  async stopScenario(scenarioId) {
    const scenario = this.activeScenarios.get(scenarioId);
    if (!scenario) {
      const err = new Error(`Scenario '${scenarioId}' is not currently running.`);
      err.statusCode = 404;
      err.code = 'SCENARIO_NOT_FOUND';
      throw err;
    }

    scenario.status = 'STOPPED';
    scenario.stoppedAt = new Date().toISOString();
    this.activeScenarios.delete(scenarioId);

    await publish('incidents.v1', scenarioId, {
      type: 'SCENARIO_STOPPED',
      tenant_id: scenario.tenantId || 'tenant-default',
      scenarioId,
      stoppedAt: scenario.stoppedAt,
    });

    logger.info({ scenarioId }, 'Chaos simulator scenario stopped');
    return scenario;
  }
}

const scenarioService = new ScenarioService();
module.exports = scenarioService;
