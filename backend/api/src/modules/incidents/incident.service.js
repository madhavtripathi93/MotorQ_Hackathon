const incidentRepo = require('./incident.repository');
const { publish } = require('../../shared/kafka/producer');
const logger = require('../../shared/logger');

class IncidentService {
  async listIncidents({ tenantId, status, severity, vin, cause, cursor, limit }) {
    return await incidentRepo.getIncidents({ tenantId, status, severity, vin, cause, cursor, limit });
  }

  async getIncidentDetails(incidentId, tenantId) {
    if (!tenantId) {
      const err = new Error('Tenant identity is required to retrieve incident forensic evidence.');
      err.statusCode = 400;
      err.code = 'TENANT_REQUIRED';
      throw err;
    }

    const incident = await incidentRepo.getById(incidentId, tenantId);
    if (!incident) {
      const err = new Error(`Incident with ID ${incidentId} not found.`);
      err.statusCode = 404;
      err.code = 'INCIDENT_NOT_FOUND';
      throw err;
    }
    const evidence = await incidentRepo.getEvidenceForIncident(incidentId, tenantId);
    return {
      incident,
      evidence,
      harmQuantification: incident.harm_estimate,
    };
  }

  async recordIncident(incidentData) {
    const incident = await incidentRepo.createIncident(incidentData);

    // Publish to incidents.v1 with tenant isolation
    await publish('incidents.v1', incident.vin, {
      type: 'INCIDENT_CREATED',
      incidentId: incident.id,
      tenant_id: incident.tenant_id || incidentData.tenantId || 'tenant-default',
      vin: incident.vin,
      signal: incident.signal_name,
      cause: incident.cause_attribution,
      severity: incident.severity,
      trustScore: incident.trust_score,
      timestamp: incident.created_at,
    });

    logger.info({
      incidentId: incident.id,
      vin: incident.vin,
      cause: incident.cause_attribution,
      severity: incident.severity,
    }, 'Dispatched new vehicle signal incident');

    return incident;
  }
}

module.exports = new IncidentService();
