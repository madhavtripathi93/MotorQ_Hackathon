const express = require('express');
const router = express.Router();
const auditController = require('./audit.controller');
const { authMiddleware } = require('../../shared/middleware/auth.middleware');

// GET /api/v1/audit/verify/chain
router.get('/audit/verify/chain', authMiddleware(), (req, res, next) => {
  auditController.verifyChain(req, res, next);
});

// GET /api/v1/audit/:decisionId
router.get('/audit/:decisionId', authMiddleware(), (req, res, next) => {
  auditController.getDecisionAudit(req, res, next);
});

// GET /api/v1/audit
router.get('/audit', authMiddleware(), (req, res, next) => {
  auditController.getRecentAuditLogs(req, res, next);
});

module.exports = router;
