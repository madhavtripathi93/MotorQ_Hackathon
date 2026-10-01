const db = require('../../shared/db');
const crypto = require('crypto');

const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

class AuditRepository {
  async getLatestHash(tenantId) {
    if (db.isLive()) {
      try {
        const res = await db.query(
          'SELECT hash_signature FROM audit_log WHERE tenant_id = $1 ORDER BY created_at DESC, id DESC LIMIT 1',
          [tenantId]
        );
        if (res.rows.length > 0 && res.rows[0].hash_signature) {
          return res.rows[0].hash_signature;
        }
      } catch (err) {
        // Fallback to genesis if query fails
      }
    } else {
      const tenantLogs = db.inMemoryStore.auditLogs.filter(l => l.tenant_id === tenantId);
      if (tenantLogs.length > 0 && tenantLogs[0].hash_signature) {
        return tenantLogs[0].hash_signature;
      }
    }
    return GENESIS_HASH;
  }

  async recordAudit({ tenantId, actorId, actionType, targetResource, evidenceSnapshot }) {
    const id = crypto.randomUUID();
    const createdAt = new Date();

    // Fetch durable preceding hash from database to maintain tamper-evident chain across replicas & restarts
    const prevHash = await this.getLatestHash(tenantId);

    // Cryptographic hash chain: SHA256(prevHash + tenant + actor + action + target + ts)
    const payloadToHash = `${prevHash}:${tenantId}:${actorId}:${actionType}:${targetResource}:${createdAt.toISOString()}`;
    const hashSignature = crypto.createHash('sha256').update(payloadToHash).digest('hex');

    const record = {
      id,
      tenant_id: tenantId,
      actor_id: actorId,
      action_type: actionType,
      target_resource: targetResource,
      evidence_snapshot: evidenceSnapshot,
      prev_hash: prevHash,
      hash_signature: hashSignature,
      created_at: createdAt,
    };

    if (db.isLive()) {
      await db.query(
        `INSERT INTO audit_log 
          (id, tenant_id, actor_id, action_type, target_resource, evidence_snapshot, hash_signature, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [id, tenantId, actorId, actionType, targetResource, JSON.stringify(evidenceSnapshot), hashSignature, createdAt]
      );
      return record;
    }

    db.inMemoryStore.auditLogs.unshift(record);
    return record;
  }

  async getByDecisionId(decisionId, tenantId = null) {
    if (db.isLive()) {
      let queryText = "SELECT * FROM audit_log WHERE evidence_snapshot->>'decisionId' = $1";
      const params = [decisionId];
      if (tenantId) {
        params.push(tenantId);
        queryText += ' AND tenant_id = $2';
      }
      const res = await db.query(queryText, params);
      return res.rows[0] || null;
    }
    return db.inMemoryStore.auditLogs.find(
      (log) => log.evidence_snapshot && 
               log.evidence_snapshot.decisionId === decisionId &&
               (!tenantId || log.tenant_id === tenantId)
    ) || null;
  }

  async getRecentLogs(tenantId = 'tenant-default', limit = 50) {
    if (db.isLive()) {
      const res = await db.query(
        'SELECT * FROM audit_log WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2',
        [tenantId, limit]
      );
      return res.rows;
    }
    return db.inMemoryStore.auditLogs
      .filter(l => !tenantId || l.tenant_id === tenantId)
      .slice(0, limit);
  }

  async verifyAuditChain(tenantId = 'tenant-default') {
    let logs = [];
    if (db.isLive()) {
      const res = await db.query(
        'SELECT * FROM audit_log WHERE tenant_id = $1 ORDER BY created_at ASC, id ASC',
        [tenantId]
      );
      logs = res.rows;
    } else {
      logs = db.inMemoryStore.auditLogs
        .filter(l => l.tenant_id === tenantId)
        .slice()
        .reverse();
    }

    if (logs.length === 0) return { isValid: true, verifiedCount: 0 };

    let expectedPrevHash = GENESIS_HASH;
    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];
      const ts = new Date(log.created_at).toISOString();
      const payloadToHash = `${expectedPrevHash}:${log.tenant_id}:${log.actor_id}:${log.action_type}:${log.target_resource}:${ts}`;
      const computedHash = crypto.createHash('sha256').update(payloadToHash).digest('hex');

      if (computedHash !== log.hash_signature) {
        return {
          isValid: false,
          brokenIndex: i,
          logId: log.id,
          expectedHash: computedHash,
          actualHash: log.hash_signature,
        };
      }
      expectedPrevHash = log.hash_signature;
    }

    return { isValid: true, verifiedCount: logs.length };
  }
}

module.exports = new AuditRepository();
