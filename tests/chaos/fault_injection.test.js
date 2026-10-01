import { describe, it, expect, beforeEach } from 'vitest';
import { faultInjector } from '../../backend/simulator/src/faults/faultInjector';
import veracityEngine from '../../backend/api/src/veracity/veracityEngine';
import contractRepo from '../../backend/api/src/modules/contracts/contract.repository';

describe('VISTA Chaos Fault Injection & Veracity Resilience Engine', () => {
  beforeEach(() => {
    faultInjector.clearScenario();
  });

  it('injects GPS spoofing anomaly and triggers cross-signal inconsistency flag', async () => {
    faultInjector.setScenario('gps_spoof', 'scn-chaos-gps-01');

    const baseEvent = {
      vin: 'VIN-CHAOS-GPS',
      seq: 10,
      signal: 'location_gps',
      value: { lat: 41.8781, lon: -87.6298 },
      eventTime: new Date().toISOString(),
      provenance: { oem: 'DEMO_OEM', firmware: '4.6' },
      context: {
        gps: { lat: 41.8781, lon: -87.6298 },
        speed_kmh: 40.0,
        odometer_km: 15000.0,
      },
    };

    const injected = faultInjector.applyFault(baseEvent);
    expect(injected).toHaveLength(1);
    expect(injected[0].groundTruth).toBe('ADVERSARIAL_GPS');
    expect(injected[0].value.lat).toBeGreaterThan(baseEvent.value.lat + 0.1);

    // Ingest baseline fix first (frame 1)
    const contract = await contractRepo.getActiveContract('location_gps');
    await veracityEngine.processTelemetry(baseEvent, contract);

    // Ingest spoofed jump 1s later (frame 2)
    const spoofedEvent = {
      ...injected[0],
      seq: 11,
      eventTime: new Date(Date.now() + 1000).toISOString(),
    };
    const veracityResult = await veracityEngine.processTelemetry(spoofedEvent, contract);
    expect(veracityResult).toBeDefined();
    expect(veracityResult.veracityRecord.trust).toBeLessThan(0.5);
    expect(veracityResult.veracityRecord.evidence).toContain('GPS_SPOOF_INCONSISTENCY');
  });

  it('injects OTA SoC unit flip and verifies attribution to CONTRACT rather than battery failure', async () => {
    faultInjector.setScenario('ota_soc_unit_flip', 'scn-chaos-ota-02');

    const baseEvent = {
      vin: 'VIN-CHAOS-OTA',
      seq: 20,
      signal: 'battery_soc',
      value: 72.5,
      eventTime: new Date().toISOString(),
      provenance: { oem: 'DEMO_OEM', firmware: '4.7', otaCampaign: 'CAMPAIGN-OTA-47' },
      context: { battery_soc: 72.5, speed_kmh: 50.0 },
    };

    const injected = faultInjector.applyFault(baseEvent);
    expect(injected).toHaveLength(1);
    expect(injected[0].groundTruth).toBe('CONTRACT_SEMANTIC_DRIFT');
    expect(injected[0].value).toBe(0.725); // Flipped from 72.5% to 0.725

    const contract = await contractRepo.getActiveContract('battery_soc');
    const veracityResult = await veracityEngine.processTelemetry(injected[0], contract);
    expect(veracityResult.veracityRecord.trust).toBeLessThan(0.5);
    expect(veracityResult.veracityRecord.topClass).toBe('CONTRACT');
  });

  it('injects sensor speed spike and verifies Stage 3 plausibility violation', async () => {
    faultInjector.setScenario('sensor_spike', 'scn-chaos-spike-03');

    const baseEvent = {
      vin: 'VIN-CHAOS-SPIKE',
      seq: 30,
      signal: 'speed_kmh',
      value: 65.0,
      eventTime: new Date().toISOString(),
      provenance: { oem: 'DEMO_OEM', firmware: '4.6' },
      context: { speed_kmh: 65.0, odometer_km: 18000.0 },
    };

    const injected = faultInjector.applyFault(baseEvent);
    expect(injected[0].groundTruth).toBe('SENSOR_CORRUPTION');
    expect(injected[0].value).toBe(420.5); // Physically impossible speed

    const contract = await contractRepo.getActiveContract('speed_kmh');
    const veracityResult = await veracityEngine.processTelemetry(injected[0], contract);
    expect(veracityResult.veracityRecord.trust).toBeLessThan(0.5);
    expect(veracityResult.veracityRecord.evidence).toContain('PHYSICALLY_IMPOSSIBLE_SPEED');
  });

  it('injects pipeline duplicate and verifies deduplication filter triggers PIPELINE_DUPLICATE', async () => {
    faultInjector.setScenario('pipeline_duplicate', 'scn-chaos-dedup-04');

    const baseEvent = {
      vin: 'VIN-CHAOS-DEDUP',
      seq: 105,
      signal: 'battery_soc',
      value: 80.0,
      eventTime: new Date().toISOString(),
      provenance: { oem: 'DEMO_OEM', firmware: '4.6' },
      context: { speed_kmh: 30.0, odometer_km: 10000.0 },
    };

    const injected = faultInjector.applyFault(baseEvent);
    expect(injected).toHaveLength(2); // Emits original and duplicate
    expect(injected[0].groundTruth).toBe('CLEAN');
    expect(injected[1].groundTruth).toBe('PIPELINE_DUPLICATE');
    expect(injected[0].seq).toBe(injected[1].seq);

    const contract = await contractRepo.getActiveContract('battery_soc');
    const firstRes = await veracityEngine.processTelemetry(injected[0], contract);
    expect(firstRes.isDuplicate).toBe(false);

    const secondRes = await veracityEngine.processTelemetry(injected[1], contract);
    expect(secondRes.isDuplicate).toBe(true);
  });
});
