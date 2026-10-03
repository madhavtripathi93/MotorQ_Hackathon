const auditRepo = require('./audit.repository');

class AuditService {
  async getAuditForDecision(decisionId, tenantId = 'tenant-default') {
    const log = await auditRepo.getByDecisionId(decisionId, tenantId);
    if (!log) {
      const err = new Error(`Audit record for decision ${decisionId} not found.`);
      err.statusCode = 404;
      err.code = 'AUDIT_NOT_FOUND';
      throw err;
    }
    return log;
  }

  async getRecentAuditLogs(tenantId = 'tenant-default', limit = 50) {
    return await auditRepo.getRecentLogs(tenantId, limit);
  }

  async verifyAuditChainIntegrity(tenantId = 'tenant-default') {
    return await auditRepo.verifyAuditChain(tenantId);
  }
}

module.exports = new AuditService();
