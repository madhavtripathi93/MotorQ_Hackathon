import { describe, it, expect } from 'vitest';
import veracityEngine from '../../backend/api/src/veracity/veracityEngine';
import contractRepo from '../../backend/api/src/modules/contracts/contract.repository';
import decisionService from '../../backend/api/src/modules/decisions/decision.service';
import auditRepo from '../../backend/api/src/modules/audit/audit.repository';

describe('VISTA End-to-End Veracity, Policy Gate & Audit Ledger Integration Pipeline', () => {
  it('processes clean telemetry, verifies decision-grade trust, and allows downstream action', async () => {
    const contract = await contractRepo.getActiveContract('battery_soc');
    const vin = 'VIN-INT-CLEAN-01';

    const event = {
      vin,
      signal: 'battery_soc',
      value: 72.0,
      seq: 1,
      eventTime: new Date().toISOString(),
      provenance: { oem: 'DEMO_OEM', firmware: '4.6' },
      context: { speed_kmh: 62.5, odometer_km: 15400.0, gps: { lat: 37.7749, lon: -122.4194 } },
    };

    const veracityResult = await veracityEngine.processTelemetry(event, contract);
    expect(veracityResult).toBeDefined();
    expect(veracityResult.veracityRecord).toBeDefined();
    expect(veracityResult.veracityRecord.trust).toBeGreaterThanOrEqual(0.80);
    const sinkTopicClean = veracityResult.veracityRecord.trust >= 0.5 ? 'telemetry.veracity.v1' : 'telemetry.quarantine.v1';
    expect(sinkTopicClean).toBe('telemetry.veracity.v1');

    // Downstream action request on verified clean telemetry
    const decision = await decisionService.evaluateAction({
      tenantId: 'tenant-default',
      vin,
      requestedAction: 'recalibrate_range',
      actor: 'operator-001',
      aiProposed: false,
    });

    expect(decision).toBeDefined();
    expect(decision.outcome).toBe('ALLOW');
    expect(decision.policy_code).toBe('POLICY_SATISFIED');

    // Cryptographic audit ledger verification
    const auditRecord = await auditRepo.getByDecisionId(decision.decision_id, 'tenant-default');
    expect(auditRecord).not.toBeNull();
    expect(auditRecord.hash_signature).toBeDefined();
    expect(auditRecord.action_type).toBe('DECISION_ALLOW');
  });

  it('quarantines OTA semantic drift, enforces ADR-001 fail-closed block, and records audit chain', async () => {
    const contract = await contractRepo.getActiveContract('battery_soc');
    const vin = 'VIN-INT-DRIFT-02';

    // Ingest corrupted OTA unit flipped event (0.72 instead of 72.0)
    const event = {
      vin,
      signal: 'battery_soc',
      value: 0.72,
      seq: 1,
      eventTime: new Date().toISOString(),
      provenance: { oem: 'DEMO_OEM', firmware: '4.7', otaCampaign: 'CAMPAIGN-OTA-47' },
      context: { speed_kmh: 45.0, odometer_km: 12000.0, gps: { lat: 41.8781, lon: -87.6298 } },
    };

    const veracityResult = await veracityEngine.processTelemetry(event, contract);
    expect(veracityResult).toBeDefined();
    expect(veracityResult.veracityRecord.trust).toBeLessThan(0.5);
    const sinkTopicQuarantine = veracityResult.veracityRecord.trust >= 0.5 ? 'telemetry.veracity.v1' : 'telemetry.quarantine.v1';
    expect(sinkTopicQuarantine).toBe('telemetry.quarantine.v1');
    expect(veracityResult.veracityRecord.topClass).toBe('CONTRACT');

    // AI Agent attempts downstream physical recovery dispatch under degraded trust
    const decision = await decisionService.evaluateAction({
      tenantId: 'tenant-default',
      vin,
      requestedAction: 'dispatch_recovery',
      actor: 'ai_dispatch_optimizer',
      aiProposed: true,
      rationale: 'Observed sudden drop in battery charge',
    });

    expect(decision.outcome).toBe('BLOCK');
    expect(decision.actual_trust).toBeLessThan(0.85);

    // Audit ledger records the blocked action
    const auditRecord = await auditRepo.getByDecisionId(decision.decision_id, 'tenant-default');
    expect(auditRecord).not.toBeNull();
    expect(auditRecord.action_type).toBe('DECISION_BLOCK');
    expect(auditRecord.evidence_snapshot.gateResult.outcome).toBe('BLOCK');

    // Cryptographic ledger hash chain remains mathematically valid
    const chainStatus = await auditRepo.verifyAuditChain('tenant-default');
    expect(chainStatus.isValid).toBe(true);
    expect(chainStatus.verifiedCount).toBeGreaterThan(0);
  });

  it('enforces multi-tenant isolation in audit ledger verification', async () => {
    const chainTenantA = await auditRepo.verifyAuditChain('tenant-default');
    const chainTenantB = await auditRepo.verifyAuditChain('tenant-isolated-xyz');

    expect(chainTenantA.isValid).toBe(true);
    expect(chainTenantB.isValid).toBe(true);
  });
});
