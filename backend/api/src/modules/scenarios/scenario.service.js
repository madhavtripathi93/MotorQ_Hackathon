const crypto = require('crypto');
const { publish } = require('../../shared/kafka/producer');
const logger = require('../../shared/logger');

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

class ScenarioService {
  constructor() {
    this.activeScenarios = new Map();
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

  async startScenario({ scenario, cohort = { firmware: '4.7', percentage: 12 }, durationSeconds = 120 }) {
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
    };

    this.activeScenarios.set(scenarioId, scenarioRecord);

    // 1. Activate fault in simulator
    try {
      const { faultInjector } = require('../../../../simulator/src/faults/faultInjector');
      const { streamProducer } = require('../../../../simulator/src/producers/streamProducer');
      faultInjector.setScenario(scenario, scenarioId);

      // Ensure simulator stream is generating telemetry
      if (!streamProducer.isRunning) {
        streamProducer.startStream({ count: 50, batchIntervalMs: 500 }).catch(() => {});
      }
    } catch (err) {
      logger.warn({ err: err.message }, 'Could not directly bind simulator fault injector');
    }

    // 2. Publish scenario state to Kafka/event bus for streaming workers & UI
    await publish('incidents.v1', scenarioId, {
      type: 'SCENARIO_STARTED',
      tenant_id: 'tenant-default',
      ...scenarioRecord,
    });

    // 3. For hero OTA unit flip scenario, trigger batch attribution after telemetry has accumulated
    if (scenario === 'ota_soc_unit_flip') {
      setTimeout(async () => {
        try {
          const { runBatchAttributionJob } = require('../../../../batch-attribution/src/worker');
          await runBatchAttributionJob('CAMPAIGN-OTA-47');
        } catch (err) {
          logger.warn({ err: err.message }, 'Automated batch attribution job trigger');
        }
      }, 1500);
    }

    logger.info({ scenarioId, scenario, groundTruth: meta.groundTruth }, 'Chaos simulator scenario started and active in data path');

    // Auto-stop timer
    setTimeout(() => {
      if (this.activeScenarios.has(scenarioId)) {
        this.stopScenario(scenarioId).catch(() => {});
      }
    }, durationSeconds * 1000);

    return scenarioRecord;
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

    try {
      const { faultInjector } = require('../../../../simulator/src/faults/faultInjector');
      faultInjector.clearScenario();
    } catch (err) {}

    await publish('incidents.v1', scenarioId, {
      type: 'SCENARIO_STOPPED',
      tenant_id: 'tenant-default',
      scenarioId,
      stoppedAt: scenario.stoppedAt,
    });

    logger.info({ scenarioId }, 'Chaos simulator scenario stopped');
    return scenario;
  }
}

const scenarioService = new ScenarioService();
module.exports = scenarioService;
