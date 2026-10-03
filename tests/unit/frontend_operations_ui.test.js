import { describe, it, expect } from 'vitest';
import {
  listFrom,
  first,
  normalizeIncident,
  normalizeVehicle,
  hasTrust,
  includes,
} from '../../frontend/src/App';

describe('Frontend Operations UI & State Derivations (CyFocus Integration Pack)', () => {
  it('extracts nested arrays across variable API response envelopes', () => {
    expect(listFrom([1, 2, 3], ['items'])).toEqual([1, 2, 3]);
    expect(listFrom({ items: [{ id: 'a' }] }, ['items', 'data'])).toEqual([{ id: 'a' }]);
    expect(listFrom({ data: [{ id: 'b' }] }, ['vehicles', 'data'])).toEqual([{ id: 'b' }]);
    expect(listFrom(null, ['items'])).toEqual([]);
    expect(listFrom(undefined, ['items'])).toEqual([]);
  });

  it('normalizes vehicle records with honest defaults and aliases', () => {
    const raw = {
      vehicleVin: 'VIN-000042',
      vehicleModel: 'Transit EV',
      firmware_version: '4.7',
      trustScore: 0.92,
      health: 'HEALTHY',
      last_seen: '2026-10-01T12:00:00Z',
    };

    const normalized = normalizeVehicle(raw);
    expect(normalized.vin).toBe('VIN-000042');
    expect(normalized.model).toBe('Transit EV');
    expect(normalized.firmware).toBe('4.7');
    expect(normalized.trust).toBe(0.92);
    expect(normalized.state).toBe('healthy');
    expect(normalized.lastEvent).toBe('2026-10-01T12:00:00Z');
  });

  it('normalizes vehicle with missing fields honestly (never fake live data)', () => {
    const emptyVehicle = {};
    const normalized = normalizeVehicle(emptyVehicle);
    expect(normalized.vin).toBe('—');
    expect(normalized.model).toBe('—');
    expect(normalized.firmware).toBe('—');
    expect(normalized.trust).toBe(null);
    expect(hasTrust(normalized.trust)).toBe(false);
  });

  it('normalizes incident records and respects severity/cause categorization', () => {
    const raw = {
      incident_id: 'inc-99',
      vehicle_vin: 'VIN-000012',
      name: 'OTA Unit Inversion',
      impact: 'CRITICAL',
      attribution: 'CONTRACT_SEMANTIC_DRIFT',
      state: 'OPEN',
      firmwareVersion: '4.7',
      trust_score: 0.12,
    };

    const inc = normalizeIncident(raw);
    expect(inc.id).toBe('inc-99');
    expect(inc.vin).toBe('VIN-000012');
    expect(inc.title).toBe('OTA Unit Inversion');
    expect(inc.severity).toBe('critical');
    expect(inc.cause).toBe('CONTRACT_SEMANTIC_DRIFT');
    expect(inc.status).toBe('open');
    expect(inc.firmware).toBe('4.7');
    expect(inc.trust).toBe(0.12);
  });

  it('evaluates trust boundaries deterministically without hallucination', () => {
    expect(hasTrust(0.0)).toBe(true);
    expect(hasTrust(0.85)).toBe(true);
    expect(hasTrust(1.0)).toBe(true);
    expect(hasTrust(-0.1)).toBe(false);
    expect(hasTrust(1.05)).toBe(false);
    expect(hasTrust(null)).toBe(false);
    expect(hasTrust(undefined)).toBe(false);
    expect(hasTrust(NaN)).toBe(false);
  });

  it('filters vehicles and incidents consistently across global search queries', () => {
    const vehicles = [
      { vin: 'VIN-000012', model: 'EV-Van', firmware: '4.7', state: 'healthy', trust: 0.12 },
      { vin: 'VIN-000088', model: 'Sedan', firmware: '4.6', state: 'healthy', trust: 0.94 },
    ];

    const matchQuery = (item, q) =>
      !q || [item.vin, item.model, item.firmware, item.state].some(val => includes(val, q));

    expect(vehicles.filter(v => matchQuery(v, 'van'))).toHaveLength(1);
    expect(vehicles.filter(v => matchQuery(v, '000088'))).toHaveLength(1);
    expect(vehicles.filter(v => matchQuery(v, 'nonexistent'))).toHaveLength(0);
  });
});
