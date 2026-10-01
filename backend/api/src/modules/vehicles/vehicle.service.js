const vehicleRepo = require('./vehicle.repository');
const redis = require('../../shared/redis');
const db = require('../../shared/db');

class VehicleService {
  async listVehicles({ tenantId, cursor, limit, firmware }) {
    return await vehicleRepo.listVehicles({ tenantId, cursor, limit, firmware });
  }

  async getVehicleTrustDimensions(vin, signal = 'battery_soc', tenantId = 'tenant-default') {
    const vehicle = await vehicleRepo.getByVin(vin, tenantId);
    if (!vehicle) {
      const err = new Error(`Vehicle with VIN ${vin} not found.`);
      err.statusCode = 404;
      err.code = 'VEHICLE_NOT_FOUND';
      throw err;
    }

    // 1. Check Redis hot cache with tenant isolation
    const tenantKey = `vista:trust:${tenantId}:${vin}:${signal}`;
    let cached = null;
    try {
      const data = await redis.get(tenantKey);
      if (data) {
        cached = JSON.parse(data);
      } else {
        const legacy = await redis.get(`vista:trust:${vin}:${signal}`);
        if (legacy) {
          const parsed = JSON.parse(legacy);
          if (!parsed.tenantId || parsed.tenantId === tenantId) {
            cached = parsed;
          }
        }
      }
    } catch (e) {}

    if (cached) {
      return {
        vin: cached.vin,
        tenantId,
        signal: cached.signal,
        value: cached.observedValue,
        trust: cached.trust,
        confidence: cached.confidence,
        provenance: cached.provenance || {
          oem: vehicle.oem,
          firmware: vehicle.firmware_version,
          contractVersion: cached.contractVersion || 'soc-v3',
        },
        reasonCodes: cached.reasonCodes || ['FRESH', 'IN_RANGE'],
        status: cached.trust >= 0.8 ? 'DECISION_GRADE' : 'DEGRADED',
        observedAt: cached.timestamp || new Date().toISOString(),
      };
    }

    // Fail-closed when no telemetry is available
    return {
      vin,
      tenantId,
      signal,
      value: null,
      trust: 0.0,
      confidence: 0.0,
      provenance: {
        oem: vehicle.oem || 'UNKNOWN',
        firmware: vehicle.firmware_version || 'UNKNOWN',
        contractVersion: null,
      },
      reasonCodes: ['NO_TELEMETRY_RECORDED', 'UNKNOWN_VERACITY'],
      status: 'NO_DATA',
      observedAt: null,
    };
  }
}

module.exports = new VehicleService();
