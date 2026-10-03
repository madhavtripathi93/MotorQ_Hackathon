const db = require('../../shared/db');

class DecisionRepository {
  async saveDecision(decisionRecord) {
    if (db.isLive()) {
      await db.query(
        `INSERT INTO decision 
          (id, decision_id, tenant_id, vin, incident_id, requested_action, outcome, policy_code, trust_threshold, actual_trust, reason_details, actor, evaluated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          decisionRecord.id,
          decisionRecord.decision_id,
          decisionRecord.tenant_id,
          decisionRecord.vin,
          decisionRecord.incident_id || null,
          decisionRecord.requested_action,
          decisionRecord.outcome,
          decisionRecord.policy_code,
          decisionRecord.trust_threshold,
          decisionRecord.actual_trust,
          JSON.stringify(decisionRecord.reason_details || {}),
          decisionRecord.actor,
          decisionRecord.evaluated_at,
        ]
      );
      return decisionRecord;
    }

    db.inMemoryStore.decisions.set(decisionRecord.decision_id, decisionRecord);
    return decisionRecord;
  }

  async getByDecisionId(decisionId) {
    if (db.isLive()) {
      const res = await db.query('SELECT * FROM decision WHERE decision_id = $1', [decisionId]);
      return res.rows[0] || null;
    }
    return db.inMemoryStore.decisions.get(decisionId) || null;
  }
}

module.exports = new DecisionRepository();
