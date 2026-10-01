const express = require('express');
const router = express.Router();
const contractController = require('./contract.controller');
const { authMiddleware } = require('../../shared/middleware/auth.middleware');

// GET /api/v1/signals/:signal/contracts
router.get('/signals/:signal/contracts', authMiddleware(), (req, res, next) => {
  contractController.getSignalContracts(req, res, next);
});

// POST /api/v1/contracts/:id/activate
router.post('/contracts/:id/activate', authMiddleware(['operator', 'admin']), (req, res, next) => {
  contractController.activateContract(req, res, next);
});

module.exports = router;
