const express = require('express');
const router = express.Router();
const vehicleController = require('./vehicle.controller');
const { authMiddleware } = require('../../shared/middleware/auth.middleware');

// GET /api/v1/vehicles
router.get('/vehicles', authMiddleware(), (req, res, next) => {
  vehicleController.listVehicles(req, res, next);
});

// GET /api/v1/vehicles/:vin/trust
router.get('/vehicles/:vin/trust', authMiddleware(), (req, res, next) => {
  vehicleController.getVehicleTrust(req, res, next);
});

module.exports = router;
