const { validateSchema } = require('./schemaValidator');
const { validateSequence } = require('./sequenceValidator');
const { validatePlausibility } = require('./plausibilityValidator');
const { validateFreshness } = require('./freshnessValidator');
const { validateCrossSignal } = require('./crossSignalValidator');
const { driftValidator } = require('./distributionDriftValidator');
const { attributionEngine } = require('./cohortAttribution');
const { fuseTrustEvidence } = require('./trustFusion');
const { evaluatePolicyDecision } = require('./decisionGate');
const { publish } = require('../shared/kafka/producer');
const redis = require('../shared/redis');
const clickhouse = require('../shared/adapters/clickhouse.adapter');
const metrics = require('../observability/metrics');
const logger = require('../shared/logger');
const crypto = require('crypto');

class VeracityEngine {
  constructor() {
    this.signalHistoryMap = new Map();
  }

  async processTelemetry(canonicalEvent, contract = null) {
    const startTime = Date.now();
    const { vin, seq, signals = {}, provenance = {}, eventTime, scenarioId, context = {} } = canonicalEvent;
    const signalName = canonicalEvent.signal || (signals && Object.keys(signals).length > 0 ? Object.keys(signals)[0] : 'battery_soc');
    const value = canonicalEvent.value !== undefined
      ? canonicalEvent.value
      : (signals[signalName] !== undefined ? signals[signalName] : context[signalName]);

    // Ensure contract strictly matches the signal being evaluated
    if (!contract || contract.canonical_name !== signalName) {
      const contractRepo = require('../modules/contracts/contract.repository');
      try {
        contract = await contractRepo.getActiveContract(signalName);
      } catch (err) {}
    }

    metrics.inc('vista_ingest_events_total');

    // Stage 1: Schema
    const schemaResult = validateSchema({ vin, seq, eventTime, value }, contract);

    // Stage 2: Sequence & Dedup
    const sequenceResult = await validateSequence({ vin, seq, signal: signalName });
    if (sequenceResult.isDuplicate) {
      // Discard duplicate
      return {
        isDuplicate: true,
        veracityRecord: null,
      };
    }

    // Stage 3: Plausibility
    const plausibilityResult = validatePlausibility({ vin, signal: signalName, value, eventTime });

    // Stage 4: Freshness
    const freshnessResult = validateFreshness({ signal: signalName, eventTime });

    // Stage 5: Cross-Signal Invariant
    const crossSignalResult = validateCrossSignal(canonicalEvent);

    // Bounded LRU eviction for history cache
    const MAX_HISTORY_KEYS = 10000;
    const histKey = `${vin}:${signalName}`;
    if (!this.signalHistoryMap.has(histKey)) {
      if (this.signalHistoryMap.size >= MAX_HISTORY_KEYS) {
        const oldestKey = this.signalHistoryMap.keys().next().value;
        this.signalHistoryMap.delete(oldestKey);
      }
      this.signalHistoryMap.set(histKey, []);
    }
    const history = this.signalHistoryMap.get(histKey);
    if (typeof value === 'number') {
      history.push(value);
      if (history.length > 50) history.shift();
    }

    // Stage 6: Distribution Drift & Change-Point
    const driftResult = driftValidator.evaluateDrift(histKey, history);
    if (driftResult.isDriftDetected) {
      metrics.inc('vista_drift_detected_total');
    }

    // Stage 7: Cohort Attribution
    const isCohortCorrelated = provenance.firmware === '4.7' || Boolean(provenance.otaCampaign);
    const attributionResult = attributionEngine.attributeCause({
      signal: signalName,
      observedValue: value,
      contract,
      firmware: provenance.firmware,
      otaCampaign: provenance.otaCampaign,
      crossSignalCoherent: crossSignalResult.isCoherent,
      isPipelineAnomaly: !plausibilityResult.isPlausible || sequenceResult.isReordered || sequenceResult.hasGap,
      isPlausible: plausibilityResult.isPlausible,
      recentDriftScore: driftResult.driftScore,
      isCohortCorrelated,
    });

    metrics.inc('vista_attribution_total', 1, { class: attributionResult.topClass });

    // Stage 8: Trust Fusion & Calibration
    const trustRecord = fuseTrustEvidence({
      schemaResult,
      sequenceResult,
      plausibilityResult,
      freshnessResult,
      crossSignalResult,
      driftResult,
      attributionResult,
    });

    const elapsedMs = Date.now() - startTime;
    metrics.observe('vista_veracity_latency_ms', elapsedMs);

    const tenantId = canonicalEvent.tenantId || canonicalEvent.tenant_id || 'tenant-default';
    const declaredFirmware = provenance.firmware || 'UNKNOWN';
    const declaredOem = provenance.oem || 'UNKNOWN';
    const declaredSourceEcu = provenance.sourceEcu || 'UNKNOWN';

    const fullVeracityRecord = {
      vin,
      tenant_id: tenantId,
      signal: signalName,
      timestamp: eventTime || new Date().toISOString(),
      observedValue: value,
      trust: trustRecord.trust,
      confidence: trustRecord.confidence,
      classProbabilities: trustRecord.classProbabilities,
      topClass: trustRecord.topClass,
      evidence: trustRecord.evidence,
      reasonCodes: trustRecord.reasonCodes,
      contractVersion: contract ? `${contract.canonical_name}-v${contract.semantic_version}` : 'v1',
      firmware: declaredFirmware,
      provenance: {
        oem: declaredOem,
        firmware: declaredFirmware,
        sourceEcu: declaredSourceEcu,
      },
      scenarioId: scenarioId || null,
    };

    // Update Redis hot cache with tenant isolation and backwards-compatible key
    const tenantTrustKey = `vista:trust:${tenantId}:${vin}:${signalName}`;
    const legacyTrustKey = `vista:trust:${vin}:${signalName}`;
    await redis.set(tenantTrustKey, JSON.stringify(fullVeracityRecord), 'EX', 3600);
    await redis.set(legacyTrustKey, JSON.stringify(fullVeracityRecord), 'EX', 3600);

    if (trustRecord.trust >= 0.8) {
      await redis.set(`vista:last_trusted:${vin}`, JSON.stringify(canonicalEvent), 'EX', 86400);
    }

    // Insert windowed telemetry to ClickHouse
    const vinHash = crypto.createHash('sha256').update(vin).digest('hex').slice(0, 16);
    clickhouse.insertWindowed([{
      vin_hash: vinHash,
      ts: fullVeracityRecord.timestamp,
      signal_name: signalName,
      value: typeof value === 'number' ? value : 0.0,
      trust_score: fullVeracityRecord.trust,
      firmware_version: fullVeracityRecord.firmware,
      contract_version: fullVeracityRecord.contractVersion,
      scenario_id: scenarioId || 'baseline',
    }]).catch((err) => {
      logger.warn({ err: err.message, vin }, 'ClickHouse telemetry window insert error');
    });

    // Dual-sink routing to Kafka topics
    if (trustRecord.trust >= 0.5) {
      publish('telemetry.veracity.v1', vinHash, fullVeracityRecord).catch((err) => {
        logger.warn({ err: err.message, vin }, 'Kafka veracity publish error');
      });
    } else {
      publish('telemetry.quarantine.v1', vinHash, fullVeracityRecord).catch((err) => {
        logger.warn({ err: err.message, vin }, 'Kafka quarantine publish error');
      });
    }

    return {
      isDuplicate: false,
      veracityRecord: fullVeracityRecord,
    };
  }
}

const veracityEngine = new VeracityEngine();
module.exports = veracityEngine;
