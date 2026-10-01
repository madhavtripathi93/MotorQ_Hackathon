const crypto = require('crypto');
const decisionRepo = require('./decision.repository');
const auditRepo = require('../audit/audit.repository');
const { ACTION_POLICIES, evaluatePolicyDecision } = require('../../veracity/decisionGate');
const { publish } = require('../../shared/kafka/producer');
const redis = require('../../shared/redis');
const db = require('../../shared/db');
const metrics = require('../../observability/metrics');
const logger = require('../../shared/logger');

class DecisionService {
  async evaluateAction({
    tenantId = 'tenant-default',
    vin,
    requestedAction,
    incidentId = null,
    actor = 'operator',
    aiProposed = false,
  }) {
    const policy = ACTION_POLICIES[requestedAction];
    const signalKey = policy ? policy.signalKey : 'speed_kmh';

    // 1. Fetch latest trust from Redis hot cache (tenant-isolated first)
    const tenantTrustKey = `vista:trust:${tenantId}:${vin}:${signalKey}`;
    let trustData = null;
    try {
      const cached = await redis.get(tenantTrustKey);
      if (cached) {
        trustData = JSON.parse(cached);
      } else {
        const legacy = await redis.get(`vista:trust:${vin}:${signalKey}`);
        if (legacy) {
          const parsed = JSON.parse(legacy);
          if (!parsed.tenantId || parsed.tenantId === tenantId) {
            trustData = parsed;
          }
        }
      }
    } catch (e) {}

    // Fail-closed initialization: default to zero trust and empty evidence
    let trustScore = 0.0;
    let evidence = ['NO_PRIOR_TELEMETRY'];

    if (trustData) {
      trustScore = typeof trustData.trust === 'number' ? trustData.trust : 0.0;
      evidence = trustData.evidence || trustData.reasonCodes || [];
    } else {
      // Check for incident or vehicle record under this specific tenant
      if (db.isLive()) {
        try {
          const incRes = await db.query(
            "SELECT * FROM incident WHERE vin = $1 AND tenant_id = $2 AND status = 'OPEN' ORDER BY created_at DESC LIMIT 1",
            [vin, tenantId]
          );
          if (incRes.rows.length > 0) {
            const openInc = incRes.rows[0];
            trustScore = Number(openInc.trust_score);
            incidentId = openInc.id;
            const evRes = await db.query(
              "SELECT evidence_code FROM incident_evidence WHERE incident_id = $1",
              [openInc.id]
            );
            evidence = evRes.rows.map(r => r.evidence_code);
          }
        } catch (err) {
          logger.warn({ err: err.message, vin }, 'Error fetching incident for decision evaluation');
        }
      } else {
        const allIncidents = Array.from(db.inMemoryStore.incidents.values());
        const openIncident = allIncidents.find(inc => inc.vin === vin && inc.tenant_id === tenantId && inc.status === 'OPEN');
        if (openIncident) {
          trustScore = Number(openIncident.trust_score);
          const evs = Array.from(db.inMemoryStore.incidentEvidence.values()).filter(e => e.incident_id === openIncident.id);
          evidence = evs.map(e => e.evidence_code);
          incidentId = openIncident.id;
        }
      }
    }

    // 2. Evaluate against deterministic policy gate
    const gateResult = evaluatePolicyDecision({
      requestedAction,
      signalKey,
      trustScore,
      evidence,
      actor,
    });

    const decisionId = `dec-${crypto.randomUUID()}`;
    const decisionRecord = {
      id: crypto.randomUUID(),
      decision_id: decisionId,
      tenant_id: tenantId,
      vin,
      incident_id: incidentId,
      requested_action: requestedAction,
      outcome: gateResult.outcome,
      policy_code: gateResult.policyCode,
      trust_threshold: gateResult.trustThreshold,
      actual_trust: gateResult.actualTrust,
      reason_details: {
        reason: gateResult.reason,
        violatingEvidence: gateResult.violatingEvidence || null,
        aiProposed,
        evidenceSnapshot: evidence,
      },
      actor,
      evaluated_at: new Date(),
    };

    // 3. Persist decision
    await decisionRepo.saveDecision(decisionRecord);

    // 4. Create immutable audit entry
    await auditRepo.recordAudit({
      tenantId,
      actorId: actor,
      actionType: `DECISION_${gateResult.outcome}`,
      targetResource: `vin:${vin}:action:${requestedAction}`,
      evidenceSnapshot: {
        decisionId,
        trustScore,
        gateResult,
        evidence,
        aiProposed,
      },
    });

    // 5. Update metrics
    if (gateResult.outcome === 'BLOCK') {
      metrics.inc('vista_decision_blocked_total');
    } else if (gateResult.outcome === 'ALLOW') {
      metrics.inc('vista_decision_allowed_total');
    } else {
      metrics.inc('vista_decision_review_total');
    }

    // 6. Publish decision event
    await publish('decisions.v1', decisionId, decisionRecord);

    logger.info({
      decisionId,
      action: requestedAction,
      outcome: gateResult.outcome,
      trust: trustScore,
      threshold: gateResult.trustThreshold,
    }, 'Policy decision evaluated');

    return decisionRecord;
  }

  // AI Agent Guardrail Tools
  async getVehicleTrust(vin, signal = 'speed_kmh', tenantId = 'tenant-default') {
    // 1. Check tenant-isolated key first
    const tenantKey = `vista:trust:${tenantId}:${vin}:${signal}`;
    let cached = null;
    try {
      const data = await redis.get(tenantKey);
      if (data) cached = JSON.parse(data);
    } catch (e) {}

    // 2. Fall back to legacy key only if matching tenant
    if (!cached) {
      try {
        const legacyData = await redis.get(`vista:trust:${vin}:${signal}`);
        if (legacyData) {
          const parsed = JSON.parse(legacyData);
          if (!parsed.tenantId || parsed.tenantId === tenantId) {
            cached = parsed;
          }
        }
      } catch (e) {}
    }

    if (cached) return cached;

    // Fail-closed when no telemetry is available
    return {
      vin,
      tenantId,
      signal,
      trust: 0.0,
      confidence: 0.0,
      evidence: ['NO_TELEMETRY_RECORDED'],
      reasonCodes: ['NO_DATA', 'UNKNOWN_VERACITY'],
      status: 'NO_DATA',
    };
  }

  async simulateAction({ vin, requestedAction, tenantId = 'tenant-default' }) {
    const policy = ACTION_POLICIES[requestedAction];
    if (!policy) {
      return { allowed: false, reason: 'UNKNOWN_ACTION' };
    }
    const trust = await this.getVehicleTrust(vin, policy.signalKey, tenantId);
    const wouldAllow = trust.trust >= policy.minTrustThreshold && trust.status !== 'NO_DATA';
    return {
      vin,
      tenantId,
      requestedAction,
      wouldAllow,
      requiredTrust: policy.minTrustThreshold,
      currentTrust: trust.trust,
      status: trust.status,
      previewNote: 'SIMULATION ONLY - No mutations or dispatches performed',
    };
  }
}

module.exports = new DecisionService();
