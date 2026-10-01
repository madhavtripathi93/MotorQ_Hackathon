const incidentService = require('./incident.service');

class IncidentController {
  async getIncidents(req, res, next) {
    try {
      const tenantId = req.tenantId || 'tenant-default';
      const { status, severity, vin, cause, cursor, limit } = req.query;
      const parsedLimit = limit ? Math.min(100, parseInt(limit, 10)) : 20;

      let parsedCursor = null;
      if (cursor) {
        try {
          parsedCursor = JSON.parse(Buffer.from(cursor, 'base64').toString('utf8'));
        } catch (e) {
          // ignore invalid cursor format
        }
      }

      const incidents = await incidentService.listIncidents({
        tenantId,
        status,
        severity,
        vin,
        cause,
        cursor: parsedCursor,
        limit: parsedLimit,
      });

      let nextCursor = null;
      if (incidents.length === parsedLimit) {
        const last = incidents[incidents.length - 1];
        nextCursor = Buffer.from(
          JSON.stringify({ createdAt: last.created_at, id: last.id })
        ).toString('base64');
      }

      res.status(200).json({
        data: incidents,
        nextCursor,
        count: incidents.length,
      });
    } catch (err) {
      next(err);
    }
  }

  async getIncidentEvidence(req, res, next) {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId || req.user?.tenant_id;
      if (!tenantId) {
        return res.status(403).json({
          error: 'TENANT_REQUIRED',
          message: 'Tenant identity required to access incident evidence.',
        });
      }
      const result = await incidentService.getIncidentDetails(id, tenantId);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new IncidentController();
