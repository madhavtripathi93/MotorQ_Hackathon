const pick = (row, keys, fallback = null) => {
  for (const key of keys) {
    if (row?.[key] !== undefined && row?.[key] !== null) return row[key];
  }
  return fallback;
};

export const PAGE_META = {
  overview: { label: 'Overview', title: 'Fleet operations', subtitle: 'Signal trust and active incidents.' },
  incidents: { label: 'Incidents', title: 'Incident Response', subtitle: 'Track and resolve telemetry anomalies.' },
  vehicles: { label: 'Vehicles', title: 'Vehicle registry', subtitle: 'Search the fleet.' },
  contracts: { label: 'Contracts', title: 'Semantic contracts', subtitle: 'Track semantic definitions and drift.' },
  trust: { label: 'Trust', title: 'Trust history', subtitle: 'Trace trust movement.' },
  simulator: { label: 'Simulator', title: 'Simulation Scenarios', subtitle: 'Run fleet-scale simulations for veracity testing.' },
  decisions: { label: 'Decisions', title: 'Decision gate', subtitle: 'Evaluate consequential actions.' },
};

export const unwrap = (payload, keys = ['data', 'items', 'vehicles', 'incidents']) => {
  if (Array.isArray(payload)) return payload;
  for (const key of keys) if (Array.isArray(payload?.[key])) return payload[key];
  return [];
};

export const normalizeVehicle = (row) => ({
  ...row,
  vin: pick(row, ['vin', 'vehicleVin', 'vehicle_vin', 'id'], '—'),
  model: pick(row, ['model', 'vehicleModel', 'vehicle_model'], '—'),
  year: pick(row, ['year', 'modelYear', 'model_year']),
  firmware: String(pick(row, ['firmware_version', 'firmwareVersion', 'firmware'], '—')),
  oem: pick(row, ['oem', 'manufacturer'], '—'),
  lastTelemetryAt: pick(row, ['last_telemetry_at', 'lastTelemetryAt', 'lastSeen', 'last_seen']),
});

export const normalizeIncident = (row) => ({
  ...row,
  id: pick(row, ['id', 'incidentId', 'incident_id', 'uuid']),
  vin: pick(row, ['vin', 'vehicleVin', 'vehicle_vin'], '—'),
  signal: pick(row, ['signal_name', 'signalName', 'signal'], '—'),
  status: String(pick(row, ['status', 'state'], 'UNKNOWN')).toUpperCase(),
  severity: String(pick(row, ['severity', 'priority'], 'UNKNOWN')).toUpperCase(),
  cause: String(pick(row, ['cause_attribution', 'cause', 'attribution', 'topClass'], 'UNKNOWN')).toUpperCase(),
  trust: finite(pick(row, ['trust_score', 'trustScore', 'trust'])),
  confidence: finite(pick(row, ['confidence'], null)),
  campaign: pick(row, ['ota_campaign_id', 'otaCampaignId', 'campaign_id']),
  createdAt: pick(row, ['created_at', 'createdAt', 'timestamp', 'detected_at']),
  harm: pick(row, ['harm_estimate', 'harmQuantification', 'harm'], {}) || {},
});

export const finite = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
export const ratio = (v) => {
  const n = finite(v);
  if (n === null) return null;
  return n > 1 ? n / 100 : n;
};
export const percent = (v, digits = 1) => {
  const n = ratio(v);
  return n === null ? '—' : `${(n * 100).toFixed(digits)}%`;
};
export const number = (v) => {
  const n = finite(v);
  return n === null ? '—' : n.toLocaleString();
};
export const time = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};
export const relative = (v) => {
  if (!v) return '—';
  const t = new Date(v).getTime();
  if (!Number.isFinite(t)) return '—';
  const min = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m`;
  if (min < 1440) return `${Math.round(min / 60)}h`;
  return `${Math.round(min / 1440)}d`;
};
export const tone = (severity) => {
  const s = String(severity).toUpperCase();
  return s === 'CRITICAL' ? 'critical' : s === 'HIGH' ? 'high' : s === 'MEDIUM' ? 'medium' : 'low';
};

export const titleForIncident = (incident) => {
  if (incident?.title) return incident.title;
  const signal = incident?.signal && incident.signal !== '—' ? incident.signal.replaceAll('_', ' ') : 'Signal';
  const cause = incident?.cause && incident.cause !== 'UNKNOWN' ? incident.cause.toLowerCase() : 'unknown';
  return `${signal.charAt(0).toUpperCase()}${signal.slice(1)} anomaly · ${cause}`;
};

// Backward-compatible aliases used by presentation components.
export const formatNumber = number;
export const severityTone = tone;
