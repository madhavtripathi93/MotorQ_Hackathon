/**
 * VISTA Relational 3NF Database Seeder
 * Populates PostgreSQL with benchmark fleets, contracts, vehicles, and audit ledger.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');
const config = require('../../config');
const logger = require('../logger');

async function seed() {
  console.log('🌱 Starting VISTA Database Seeder (PostgreSQL)...');
  console.log(`📡 Connecting to: ${config.DATABASE_URL.replace(/:[^:@]+@/, ':****@')}`);

  const pool = new Pool({
    connectionString: config.DATABASE_URL,
    connectionTimeoutMillis: 5000,
  });

  try {
    // 1. Run Schema DDL
    const schemaPath = path.join(__dirname, 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      console.log('📜 Applying 3NF Schema DDL from schema.sql...');
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      await pool.query(schemaSql);
      console.log('✅ Schema DDL applied successfully.');
    }

    // 2. Seed Fleet
    const fleetId = 'f1000000-0000-0000-0000-000000000001';
    await pool.query(`
      INSERT INTO fleet (id, tenant_id, name, metadata, created_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (id) DO NOTHING;
    `, [
      fleetId,
      'tenant-default',
      'North America Commercial EV Fleet',
      JSON.stringify({ region: 'US-East', maxVehicles: 100000 }),
    ]);
    console.log('✅ Seeded default commercial fleet.');

    // 3. Seed Signal Contracts
    const contracts = [
      {
        id: 'c1000000-0000-0000-0000-000000000001',
        canonical_name: 'battery_soc',
        semantic_version: 3,
        unit: '% (0-100)',
        source_ecu: 'BMS_PRIMARY',
        sampling_hz: 1.0,
        min_value: 0.0,
        max_value: 100.0,
        semantics_json: {
          scale: '0-100',
          nominal_discharge_rate_max: 5.0,
          allow_regen_increase: true,
        },
        active_from: '2026-01-01T00:00:00Z',
      },
      {
        id: 'c1000000-0000-0000-0000-000000000002',
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
        active_from: '2026-01-01T00:00:00Z',
      },
      {
        id: 'c1000000-0000-0000-0000-000000000003',
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
        active_from: '2026-01-01T00:00:00Z',
      },
      {
        id: 'c1000000-0000-0000-0000-000000000004',
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
        active_from: '2026-09-15T00:00:00Z',
      },
    ];

    for (const c of contracts) {
      await pool.query(`
        INSERT INTO signal_contract (id, canonical_name, semantic_version, unit, source_ecu, sampling_hz, min_value, max_value, semantics_json, active_from)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (canonical_name, semantic_version) DO NOTHING;
      `, [
        c.id,
        c.canonical_name,
        c.semantic_version,
        c.unit,
        c.source_ecu,
        c.sampling_hz,
        c.min_value,
        c.max_value,
        JSON.stringify(c.semantics_json),
        c.active_from,
      ]);
    }
    console.log(`✅ Seeded ${contracts.length} canonical signal contracts.`);

    // 4. Seed Contract Change Records
    await pool.query(`
      INSERT INTO contract_change (id, canonical_name, old_version, new_version, diff_json, change_ticket, released_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (id) DO NOTHING;
    `, [
      'cc-00000000-0000-0000-0000-000000000001',
      'battery_soc',
      3,
      4,
      JSON.stringify({
        field: 'battery_soc',
        old_scale: '0-100%',
        new_scale: '0.0-1.0 (unit interval)',
        impact: 'Values compressed by 100x; downstream range estimation drops from 320km to 3.2km without normalization',
      }),
      'OTA-ENG-8492',
      '2026-09-15T00:00:00Z',
    ]);
    console.log('✅ Seeded contract change log (OTA-ENG-8492).');

    // 5. Seed Contract Mapping
    await pool.query(`
      INSERT INTO contract_mapping (id, contract_id, oem, source_field, transform_expr, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (id) DO NOTHING;
    `, [
      'cm-00000000-0000-0000-0000-000000000001',
      'c1000000-0000-0000-0000-000000000001',
      'DEMO_OEM',
      'signals.batterySocPct',
      'value / 100.0',
    ]);
    console.log('✅ Seeded OEM contract normalization mappings.');

    // 6. Seed Signal Dependencies (Cross-Signal Invariants)
    await pool.query(`
      INSERT INTO signal_dependency (id, signal_name, depends_on_signal, relation_type, invariant_config, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (id) DO NOTHING;
    `, [
      'sd-00000000-0000-0000-0000-000000000001',
      'location_gps',
      'speed_kmh',
      'INTEGRAL_CONSISTENCY',
      JSON.stringify({ maxDiscrepancyPercentage: 15.0 }),
    ]);
    console.log('✅ Seeded cross-signal kinematic invariants.');

    // 7. Seed 200 Benchmark Vehicles
    console.log('🚗 Seeding 200 benchmark connected vehicles (Treatment vs Control cohorts)...');
    for (let i = 1; i <= 200; i++) {
      const vinNum = String(i).padStart(6, '0');
      const vin = `VIN-${vinNum}`;
      const isTreatment = i <= 50; // First 50 vehicles received Firmware 4.7
      const fw = isTreatment ? '4.7' : '4.6';
      const vehId = crypto.randomUUID();

      await pool.query(`
        INSERT INTO vehicle (id, tenant_id, vin, fleet_id, oem, model, year, firmware_version, last_telemetry_at, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        ON CONFLICT (vin) DO UPDATE SET firmware_version = EXCLUDED.firmware_version;
      `, [
        vehId,
        'tenant-default',
        vin,
        fleetId,
        'DEMO_OEM',
        'V-Transit E-Van',
        2025,
        fw,
      ]);

      await pool.query(`
        INSERT INTO vehicle_software (id, vin, firmware_version, campaign_id, deployed_at)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (id) DO NOTHING;
      `, [
        crypto.randomUUID(),
        vin,
        fw,
        isTreatment ? 'CAMPAIGN-OTA-47' : 'BASELINE-46',
        isTreatment ? '2026-09-20T08:00:00Z' : '2026-01-01T00:00:00Z',
      ]);
    }
    console.log('✅ Seeded 200 vehicles with firmware deployment campaign history.');

    // 8. Seed Hero Incidents with Evidence
    const inc1Id = '48291000-0000-0000-0000-000000000001';
    await pool.query(`
      INSERT INTO incident (id, tenant_id, vin, signal_name, status, severity, cause_attribution, trust_score, confidence, ota_campaign_id, harm_estimate, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW() - INTERVAL '15 minutes')
      ON CONFLICT (id) DO NOTHING;
    `, [
      inc1Id,
      'tenant-default',
      'VIN-000012',
      'battery_soc',
      'OPEN',
      'CRITICAL',
      'CONTRACT',
      0.12,
      0.94,
      'CAMPAIGN-OTA-47',
      JSON.stringify({
        affectedVehicles: 12431,
        downstreamConsumers: ['range_estimator', 'charge_dispatch'],
        estimatedImpact: {
          rangeMaeKm: 18.4,
          falseAlerts: 3812,
          blockedActions: 27,
          avoidedImpactCost: '$148,200 (simulator-derived avoided-impact estimate)',
        },
      }),
    ]);

    await pool.query(`
      INSERT INTO incident_evidence (id, incident_id, evidence_code, description, payload, recorded_at)
      VALUES ($1, $2, $3, $4, $5, NOW() - INTERVAL '15 minutes')
      ON CONFLICT (id) DO NOTHING;
    `, [
      'ev-00000000-0000-0000-0000-000000000001',
      inc1Id,
      'UNIT_SCALE_INVERSION',
      'Values compressed to [0.0, 1.0] interval while contract specifies [0, 100]. Firmware 4.7 cohort correlation = 99.8%.',
      JSON.stringify({ observedSample: 0.721, expectedMin: 10.0, contractVersion: 'soc-v3' }),
    ]);
    console.log('✅ Seeded hero incident 1 (OTA SoC Unit Scale Inversion).');

    // 9. Seed Initial Genesis Audit Record
    const genesisEntry = {
      tenant_id: 'tenant-default',
      actor_id: 'system_bootstrap',
      action_type: 'GENESIS_BOOTSTRAP',
      target_resource: 'database:schema',
      evidence_snapshot: { seededVehicles: 200, contracts: contracts.length },
    };
    const prevHash = '0'.repeat(64);
    const hashSignature = crypto
      .createHash('sha256')
      .update(prevHash + genesisEntry.tenant_id + genesisEntry.action_type + genesisEntry.target_resource + JSON.stringify(genesisEntry.evidence_snapshot))
      .digest('hex');

    await pool.query(`
      INSERT INTO audit_log (id, tenant_id, actor_id, action_type, target_resource, evidence_snapshot, hash_signature, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      ON CONFLICT (id) DO NOTHING;
    `, [
      crypto.randomUUID(),
      genesisEntry.tenant_id,
      genesisEntry.actor_id,
      genesisEntry.action_type,
      genesisEntry.target_resource,
      JSON.stringify(genesisEntry.evidence_snapshot),
      hashSignature,
    ]);
    console.log(`✅ Seeded cryptographic audit genesis record (${hashSignature.slice(0, 16)}...).`);

    console.log('\n🎉 VISTA database seed completed successfully!');
  } catch (err) {
    console.warn(`⚠️ PostgreSQL seed warning: ${err.message}`);
    console.warn('Note: In standalone mode without active PostgreSQL, VISTA utilizes its embedded active in-memory repository store.');
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  seed().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = { seed };
