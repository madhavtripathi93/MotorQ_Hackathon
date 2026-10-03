const express = require('express');
const router = express.Router();
const incidentController = require('./incident.controller');
const { authMiddleware } = require('../../shared/middleware/auth.middleware');

// GET /api/v1/incidents
router.get('/incidents', authMiddleware(), (req, res, next) => {
  incidentController.getIncidents(req, res, next);
});

// GET /api/v1/incidents/:id/evidence
router.get('/incidents/:id/evidence', authMiddleware(), (req, res, next) => {
  incidentController.getIncidentEvidence(req, res, next);
});

// POST /api/v1/incidents/:id/acknowledge
router.post('/incidents/:id/acknowledge', authMiddleware(), (req, res, next) => {
  incidentController.acknowledgeIncident(req, res, next);
});

module.exports = router;
