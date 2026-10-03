const db = require('../../shared/db');
const crypto = require('crypto');

class IncidentRepository {
  async getIncidents({ tenantId, status, severity, vin, cause, cursor, limit = 20 }) {
    if (db.isLive()) {
      let queryText = 'SELECT * FROM incident WHERE tenant_id = $1';
      const params = [tenantId];

      if (status) {
        params.push(status);
        queryText += ` AND status = $${params.length}`;
      }
      if (severity) {
        params.push(severity);
        queryText += ` AND severity = $${params.length}`;
      }
      if (vin) {
        params.push(vin);
        queryText += ` AND vin = $${params.length}`;
      }
      if (cause) {
        params.push(cause);
        queryText += ` AND cause_attribution = $${params.length}`;
      }
      if (cursor && cursor.createdAt && cursor.id) {
        params.push(cursor.createdAt, cursor.id);
        queryText += ` AND (created_at, id) < ($${params.length - 1}, $${params.length})`;
      }

      queryText += ` ORDER BY created_at DESC, id DESC LIMIT $${params.length + 1}`;
      params.push(limit);

      const res = await db.query(queryText, params);
      return res.rows;
    }

    // In-memory filter with keyset pagination simulation
    let items = Array.from(db.inMemoryStore.incidents.values()).filter(
      (inc) => inc.tenant_id === tenantId
    );

    if (status) items = items.filter((inc) => inc.status === status);
    if (severity) items = items.filter((inc) => inc.severity === severity);
    if (vin) items = items.filter((inc) => inc.vin === vin);
    if (cause) items = items.filter((inc) => inc.cause_attribution === cause);

    items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    if (cursor && cursor.createdAt) {
      const cursorTs = new Date(cursor.createdAt).getTime();
      items = items.filter((inc) => new Date(inc.created_at).getTime() < cursorTs);
    }

    return items.slice(0, limit);
  }

  async getById(id, tenantId) {
    if (!tenantId) {
      throw new Error('TENANT_ID_REQUIRED: Tenant scope is mandatory for incident lookup.');
    }
    if (db.isLive()) {
      const res = await db.query(
        'SELECT * FROM incident WHERE id = $1 AND tenant_id = $2',
        [id, tenantId]
      );
      return res.rows[0] || null;
    }
    const inc = db.inMemoryStore.incidents.get(id);
    if (!inc || inc.tenant_id !== tenantId) return null;
    return inc;
  }

  // Tenant-scoped evidence query joined against parent incident
  async getEvidenceForIncident(incidentId, tenantId) {
    if (!tenantId) {
      throw new Error('TENANT_ID_REQUIRED: Tenant scope is mandatory for evidence lookup.');
    }
    if (db.isLive()) {
      const res = await db.query(
        `SELECT e.* 
         FROM incident_evidence e
         JOIN incident i ON e.incident_id = i.id
         WHERE e.incident_id = $1 AND i.tenant_id = $2
         ORDER BY e.recorded_at ASC`,
        [incidentId, tenantId]
      );
      return res.rows;
    }
    const inc = db.inMemoryStore.incidents.get(incidentId);
    if (!inc || inc.tenant_id !== tenantId) return [];

    const all = Array.from(db.inMemoryStore.incidentEvidence.values());
    return all.filter((ev) => ev.incident_id === incidentId);
  }

  async createIncident({
    tenantId,
    vin,
    signalName,
    status = 'OPEN',
    severity = 'HIGH',
    causeAttribution = 'UNKNOWN',
    trustScore = 0.5,
    confidence = 0.8,
    otaCampaignId = null,
    harmEstimate = {},
    evidenceList = [],
  }) {
    const id = crypto.randomUUID();
    const incidentRecord = {
      id,
      tenant_id: tenantId,
      vin,
      signal_name: signalName,
      status,
      severity,
      cause_attribution: causeAttribution,
      trust_score: trustScore,
      confidence,
      ota_campaign_id: otaCampaignId,
      harm_estimate: harmEstimate,
      created_at: new Date(),
      resolved_at: null,
    };

    if (db.isLive()) {
      await db.query(
        `INSERT INTO incident 
          (id, tenant_id, vin, signal_name, status, severity, cause_attribution, trust_score, confidence, ota_campaign_id, harm_estimate, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          id, tenantId, vin, signalName, status, severity, causeAttribution,
          trustScore, confidence, otaCampaignId, JSON.stringify(harmEstimate), incidentRecord.created_at,
        ]
      );

      for (const ev of evidenceList) {
        const evId = crypto.randomUUID();
        await db.query(
          `INSERT INTO incident_evidence (id, incident_id, evidence_code, description, payload, recorded_at)
           VALUES ($1, $2, $3, $4, $5, NOW())`,
          [evId, id, ev.code, ev.description, JSON.stringify(ev.payload || {})]
        );
      }
    } else {
      db.inMemoryStore.incidents.set(id, incidentRecord);
      for (const ev of evidenceList) {
        const evId = crypto.randomUUID();
        db.inMemoryStore.incidentEvidence.set(evId, {
          id: evId,
          incident_id: id,
          evidence_code: ev.code,
          description: ev.description,
          payload: ev.payload || {},
          recorded_at: new Date(),
        });
      }
    }

    return incidentRecord;
  }

  async clearTenantIncidents(tenantId) {
    if (!tenantId) return;
    if (db.isLive()) {
      await db.query('DELETE FROM incident_evidence WHERE incident_id IN (SELECT id FROM incident WHERE tenant_id = $1)', [tenantId]);
      await db.query('DELETE FROM incident WHERE tenant_id = $1', [tenantId]);
    } else {
      const incToDelete = [];
      for (const [id, inc] of db.inMemoryStore.incidents.entries()) {
        if (inc.tenant_id === tenantId) {
          incToDelete.push(id);
        }
      }
      incToDelete.forEach(id => db.inMemoryStore.incidents.delete(id));

      const evToDelete = [];
      for (const [evId, ev] of db.inMemoryStore.incidentEvidence.entries()) {
        if (incToDelete.includes(ev.incident_id)) {
          evToDelete.push(evId);
        }
      }
      evToDelete.forEach(id => db.inMemoryStore.incidentEvidence.delete(id));
    }
  }

  async updateIncidentStatus(incidentId, tenantId, status) {
    if (db.isLive()) {
      const result = await db.query(
        'UPDATE incident SET status = $1, resolved_at = NOW() WHERE id = $2 AND tenant_id = $3 RETURNING *',
        [status, incidentId, tenantId]
      );
      return result.rows[0];
    } else {
      const incident = db.inMemoryStore.incidents.get(incidentId);
      if (!incident || incident.tenant_id !== tenantId) {
        return null;
      }
      incident.status = status;
      incident.updated_at = new Date();
      return incident;
    }
  }
}

module.exports = new IncidentRepository();
