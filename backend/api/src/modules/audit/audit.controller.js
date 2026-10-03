const auditService = require('./audit.service');

class AuditController {
  async getDecisionAudit(req, res, next) {
    try {
      const { decisionId } = req.params;
      const tenantId = req.tenantId || 'tenant-default';
      const log = await auditService.getAuditForDecision(decisionId, tenantId);
      res.status(200).json(log);
    } catch (err) {
      next(err);
    }
  }

  async getRecentAuditLogs(req, res, next) {
    try {
      const tenantId = req.tenantId || 'tenant-default';
      const limit = req.query.limit ? parseInt(req.query.limit, 10) : 50;
      const logs = await auditService.getRecentAuditLogs(tenantId, limit);
      res.status(200).json({ logs });
    } catch (err) {
      next(err);
    }
  }

  async verifyChain(req, res, next) {
    try {
      const tenantId = req.tenantId || 'tenant-default';
      const verification = await auditService.verifyAuditChainIntegrity(tenantId);
      res.status(200).json(verification);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AuditController();
