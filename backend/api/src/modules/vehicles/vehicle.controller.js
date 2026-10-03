const vehicleService = require('./vehicle.service');

class VehicleController {
  async listVehicles(req, res, next) {
    try {
      const tenantId = req.tenantId || 'tenant-default';
      const { cursor, limit, firmware } = req.query;
      const parsedLimit = limit ? Math.min(400, parseInt(limit, 10)) : 50;

      const vehicles = await vehicleService.listVehicles({
        tenantId,
        cursor,
        limit: parsedLimit,
        firmware,
      });

      let nextCursor = null;
      if (vehicles.length === parsedLimit) {
        nextCursor = vehicles[vehicles.length - 1].vin;
      }

      res.status(200).json({
        data: vehicles,
        nextCursor,
        count: vehicles.length,
      });
    } catch (err) {
      next(err);
    }
  }

  async getVehicleTrust(req, res, next) {
    try {
      const { vin } = req.params;
      const { signal = 'battery_soc' } = req.query;
      const tenantId = req.tenantId || 'tenant-default';
      const data = await vehicleService.getVehicleTrustDimensions(vin, signal, tenantId);
      res.status(200).json(data);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new VehicleController();
