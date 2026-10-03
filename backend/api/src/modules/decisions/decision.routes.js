const express = require('express');
const router = express.Router();
const decisionController = require('./decision.controller');
const { authMiddleware } = require('../../shared/middleware/auth.middleware');

// POST /api/v1/decisions/evaluate
router.post('/decisions/evaluate', authMiddleware(), (req, res, next) => {
  decisionController.evaluateDecision(req, res, next);
});

// AI Agent tools endpoints
router.get('/decisions/agent/trust/:vin', authMiddleware(), (req, res, next) => {
  decisionController.getTrust(req, res, next);
});

router.post('/decisions/agent/simulate', authMiddleware(), (req, res, next) => {
  decisionController.simulate(req, res, next);
});

module.exports = router;
