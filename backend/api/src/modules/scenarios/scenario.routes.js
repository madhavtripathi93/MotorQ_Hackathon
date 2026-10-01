const express = require('express');
const router = express.Router();
const scenarioController = require('./scenario.controller');
const { authMiddleware } = require('../../shared/middleware/auth.middleware');

// GET /api/v1/scenarios
router.get('/scenarios', authMiddleware(), (req, res) => {
  scenarioController.getAvailable(req, res);
});

// POST /api/v1/scenarios/start
router.post('/scenarios/start', authMiddleware(['operator', 'admin']), (req, res, next) => {
  scenarioController.start(req, res, next);
});

// POST /api/v1/scenarios/stop
router.post('/scenarios/stop', authMiddleware(['operator', 'admin']), (req, res, next) => {
  scenarioController.stop(req, res, next);
});

module.exports = router;
