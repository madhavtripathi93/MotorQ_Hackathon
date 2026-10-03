const { Pool } = require('pg');
const config = require('../../config');
const logger = require('../logger');
const crypto = require('crypto');

class InMemoryStore {
  constructor() {
    this.fleets = new Map();
    this.vehicles = new Map();
    this.contracts = new Map();
    this.contractChanges = new Map();
    this.contractMappings = new Map();
    this.signalDependencies = new Map();
    this.vehicleSoftware = new Map();
    this.incidents = new Map();
    this.incidentEvidence = new Map();
    this.decisions = new Map();
    this.auditLogs = [];
    this.seedDefaultData();
  }

  seedDefaultData() {
    // Default tenant & fleet
    const fleetId = 'f1000000-0000-0000-0000-000000000001';
    this.fleets.set(fleetId, {
      id: fleetId,
      tenant_id: 'tenant-default',
      name: 'North America Commercial EV Fleet',
      metadata: { region: 'US-East', maxVehicles: 100000 },
      created_at: new Date('2026-01-01T00:00:00Z'),
    });

    // Seed contracts (e.g. battery_soc v3 & v4, speed_kmh v4, location_gps v1)
    const socV3Id = 'c1000000-0000-0000-0000-000000000001';
    this.contracts.set(socV3Id, {
      id: socV3Id,
      canonical_name: 'battery_soc',
      semantic_version: 3,
      unit: '% (0-100)',
      source_ecu: 'BMS_PRIMARY',
      sampling_hz: 1.0,
      min_value: 0.0,
      max_value: 100.0,
      semantics_json: {
        scale: '0-100',
        nominal_discharge_rate_max: 5.0, // max 5 pp/sec drop
        allow_regen_increase: true,
      },
      active_from: new Date('2026-01-01T00:00:00Z'),
      active_to: null,
    });

    const speedV4Id = 'c1000000-0000-0000-0000-000000000002';
    this.contracts.set(speedV4Id, {
      id: speedV4Id,
      canonical_name: 'speed_kmh',
      semantic_version: 4,
      unit: 'km/h',
      source_ecu: 'ESP_WHEEL_SPEED',
      sampling_hz: 10.0,
      min_value: 0.0,
      max_value: 250.0,
      semantics_json: {
        max_acceleration_g: 1.2,
        max_deceleration_g: 1.5,
      },
      active_from: new Date('2026-01-01T00:00:00Z'),
      active_to: null,
    });

    const locationV1Id = 'c1000000-0000-0000-0000-000000000003';
    this.contracts.set(locationV1Id, {
      id: locationV1Id,
      canonical_name: 'location_gps',
      semantic_version: 1,
      unit: 'lat_lon_wgs84',
      source_ecu: 'TCU_GNSS',
      sampling_hz: 1.0,
      min_value: -180.0,
      max_value: 180.0,
      semantics_json: {
        max_jump_km_per_sec: 0.1,
      },
      active_from: new Date('2026-01-01T00:00:00Z'),
      active_to: null,
    });

    const socV4Id = 'c1000000-0000-0000-0000-000000000004';
    this.contracts.set(socV4Id, {
      id: socV4Id,
      canonical_name: 'battery_soc',
      semantic_version: 4,
      unit: 'ratio (0.0-1.0)',
      source_ecu: 'BMS_PRIMARY',
      sampling_hz: 1.0,
      min_value: 0.0,
      max_value: 1.0,
      semantics_json: {
        scale: '0.0-1.0',
        nominal_discharge_rate_max: 0.05,
        allow_regen_increase: true,
      },
      active_from: new Date('2026-09-15T00:00:00Z'),
      active_to: null,
    });

    // Contract change: OTA SoC unit flip diff
    this.contractChanges.set('cc-001', {
      id: 'cc-001',
      canonical_name: 'battery_soc',
      old_version: 3,
      new_version: 4,
      diff_json: {
        field: 'battery_soc',
        old_scale: '0-100%',
        new_scale: '0.0-1.0 (unit interval)',
        impact: 'Values compressed by 100x; downstream range estimation drops from 320km to 3.2km without normalization',
      },
      change_ticket: 'OTA-ENG-8492',
      released_at: new Date('2026-09-15T00:00:00Z'),
    });

    // Signal dependency: speed vs odometer vs gps
    this.signalDependencies.set('sd-001', {
      id: 'sd-001',
      signal_name: 'location_gps',
      depends_on_signal: 'speed_kmh',
      relation_type: 'INTEGRAL_CONSISTENCY',
      invariant_config: { maxDiscrepancyPercentage: 15.0 },
    });

    // Seed benchmark vehicles
    for (let i = 1; i <= 200; i++) {
      const vinNum = String(i).padStart(6, '0');
      const vin = `VIN-${vinNum}`;
      const fw = i <= 50 ? '4.7' : '4.6'; // first 50 in OTA treatment cohort
      this.vehicles.set(vin, {
        id: crypto.randomUUID(),
        tenant_id: 'tenant-default',
        vin,
        fleet_id: fleetId,
        oem: 'DEMO_OEM',
        model: 'V-Transit E-Van',
        year: 2025,
        firmware_version: fw,
        last_telemetry_at: new Date(),
        created_at: new Date(),
      });

      this.vehicleSoftware.set(`${vin}-sw`, {
        id: crypto.randomUUID(),
        vin,
        firmware_version: fw,
        campaign_id: fw === '4.7' ? 'CAMPAIGN-OTA-47' : 'BASELINE-46',
        deployed_at: fw === '4.7' ? new Date('2026-09-20T08:00:00Z') : new Date('2026-01-01T00:00:00Z'),
      });
    }

    // Seed sample hero incidents
    const inc1Id = '48291000-0000-0000-0000-000000000001';
    this.incidents.set(inc1Id, {
      id: inc1Id,
      tenant_id: 'tenant-default',
      vin: 'VIN-000012',
      signal_name: 'battery_soc',
      status: 'OPEN',
      severity: 'CRITICAL',
      cause_attribution: 'CONTRACT',
      trust_score: 0.12,
      confidence: 0.94,
      ota_campaign_id: 'CAMPAIGN-OTA-47',
      harm_estimate: {
        affectedVehicles: 12431,
        downstreamConsumers: ['range_estimator', 'charge_dispatch'],
        estimatedImpact: {
          rangeMaeKm: 18.4,
          falseAlerts: 3812,
          blockedActions: 27,
          avoidedImpactCost: '$148,200 (simulator-derived avoided-impact estimate)',
        },
      },
      created_at: new Date(Date.now() - 1000 * 60 * 15),
      resolved_at: null,
    });

    this.incidentEvidence.set('ev-1', {
      id: 'ev-1',
      incident_id: inc1Id,
      evidence_code: 'UNIT_SCALE_INVERSION',
      description: 'Values compressed to [0.0, 1.0] interval while contract specifies [0, 100]. Firmware 4.7 cohort correlation = 99.8%.',
      payload: { observedSample: 0.721, expectedMin: 10.0, contractVersion: 'soc-v3' },
      recorded_at: new Date(Date.now() - 1000 * 60 * 15),
    });

    const inc2Id = '48292000-0000-0000-0000-000000000002';
    this.incidents.set(inc2Id, {
      id: inc2Id,
      tenant_id: 'tenant-default',
      vin: 'VIN-000088',
      signal_name: 'location_gps',
      status: 'OPEN',
      severity: 'HIGH',
      cause_attribution: 'TELEMETRY',
      trust_score: 0.08,
      confidence: 0.96,
      ota_campaign_id: null,
      harm_estimate: {
        affectedVehicles: 1,
        downstreamConsumers: ['recovery_workflow', 'geofence_lock'],
        estimatedImpact: {
          locationDiscrepancyKm: 14.8,
          blockedActions: 1,
          avoidedImpactCost: '$450 towing dispatch averted',
        },
      },
      created_at: new Date(Date.now() - 1000 * 60 * 8),
      resolved_at: null,
    });

    this.incidentEvidence.set('ev-2', {
      id: 'ev-2',
      incident_id: inc2Id,
      evidence_code: 'GPS_SPOOF_INCONSISTENCY',
      description: 'GPS coordinates jumped 14.8 km in 1.0s while wheel speed = 42 km/h and odometer advanced by only 12 meters.',
      payload: { deltaGpsKm: 14.8, deltaOdometerKm: 0.012, speedIntegralKm: 0.0116 },
      recorded_at: new Date(Date.now() - 1000 * 60 * 8),
    });
  }
}

const inMemoryStore = new InMemoryStore();

let pool;
let isPostgresLive = false;

try {
  pool = new Pool({
    connectionString: config.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  pool.on('error', (err) => {
    logger.warn({ err: err.message }, 'PostgreSQL connection issue; active repository fallback ready');
  });

  pool.query('SELECT 1').then(async () => {
    isPostgresLive = true;
    logger.info('Connected to PostgreSQL successfully');
    
    try {
      // Seed Contracts
      const { rows: contractRows } = await pool.query('SELECT COUNT(*) FROM signal_contract');
      if (parseInt(contractRows[0].count) === 0) {
        logger.info('Seeding Postgres signal_contract table from default definitions...');
        for (const [id, c] of inMemoryStore.contracts.entries()) {
          await pool.query(
            'INSERT INTO signal_contract (id, canonical_name, semantic_version, unit, source_ecu, sampling_hz, min_value, max_value, semantics_json, active_from, active_to) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) ON CONFLICT DO NOTHING',
            [c.id, c.canonical_name, c.semantic_version, c.unit, c.source_ecu, c.sampling_hz, c.min_value, c.max_value, c.semantics_json, c.active_from, c.active_to]
          );
        }
      }

      // Seed Vehicles
      const { rows: vehicleRows } = await pool.query('SELECT COUNT(*) FROM vehicle');
      if (parseInt(vehicleRows[0].count) === 0) {
        logger.info('Seeding Postgres vehicle and fleet tables from default definitions...');
        const fleetId = crypto.randomUUID();
        await pool.query('INSERT INTO fleet (id, tenant_id, name) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [fleetId, 'tenant-default', 'VISTA Global Fleet']);
        for (const [vin, v] of inMemoryStore.vehicles.entries()) {
          await pool.query(
            'INSERT INTO vehicle (id, tenant_id, vin, fleet_id, oem, model, year, firmware_version, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT DO NOTHING',
            [v.id, v.tenant_id, v.vin, fleetId, v.oem, v.model, v.year, v.firmware_version, v.created_at]
          );
        }
      }

      // Seed Incidents
      const { rows: incidentRows } = await pool.query('SELECT COUNT(*) FROM incident');
      if (parseInt(incidentRows[0].count) === 0) {
        logger.info('Seeding Postgres incident table from default definitions...');
        for (const [id, inc] of inMemoryStore.incidents.entries()) {
          await pool.query(
            'INSERT INTO incident (id, tenant_id, vin, signal_name, status, severity, anomaly_score, detected_at, metadata) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT DO NOTHING',
            [inc.id, inc.tenant_id, inc.vin, inc.signal_name, inc.status, inc.severity, inc.anomaly_score, inc.detected_at, inc.metadata]
          );
        }
      }
    } catch (err) {
      logger.warn({ err: err.message }, 'Failed to seed Postgres tables');
    }
  }).catch(() => {
    isPostgresLive = false;
    logger.info('Running with high-performance active in-memory repository store');
  });
} catch (err) {
  isPostgresLive = false;
}

module.exports = {
  pool,
  inMemoryStore,
  isLive: () => isPostgresLive,
  query: async (text, params) => {
    if (isPostgresLive && pool) {
      try {
        return await pool.query(text, params);
      } catch (err) {
        logger.warn({ err: err.message }, 'PostgreSQL query failed');
        if (config.NODE_ENV === 'production') {
          throw new Error(`FAIL_CLOSED: PostgreSQL query error in production mode: ${err.message}`);
        }
      }
    } else if (config.NODE_ENV === 'production') {
      throw new Error('FAIL_CLOSED: PostgreSQL database is unreachable in production mode. Refusing non-authoritative execution.');
    }
    return { rows: [], rowCount: 0 };
  },
  end: async () => {
    if (pool) await pool.end();
  },
};
