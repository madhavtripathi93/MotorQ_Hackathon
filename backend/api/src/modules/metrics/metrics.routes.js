const express = require('express');
const router = express.Router();
const metrics = require('../../observability/metrics');

// GET /api/v1/metrics/veracity
router.get('/metrics/veracity', (req, res) => {
  const snapshot = metrics.getSnapshot();
  res.status(200).json(snapshot);
});

// GET /metrics (Prometheus standard exporter format)
router.get('/metrics', (req, res) => {
  const snap = metrics.getSnapshot();
  let prom = '';

  prom += '# HELP vista_ingest_events_total Total telemetry events ingested\n';
  prom += '# TYPE vista_ingest_events_total counter\n';
  prom += `vista_ingest_events_total ${snap.counters.vista_ingest_events_total}\n\n`;

  prom += '# HELP vista_duplicate_events_total Total duplicate events suppressed\n';
  prom += '# TYPE vista_duplicate_events_total counter\n';
  prom += `vista_duplicate_events_total ${snap.counters.vista_duplicate_events_total}\n\n`;

  prom += '# HELP vista_sequence_gap_total Total sequence gap events detected\n';
  prom += '# TYPE vista_sequence_gap_total counter\n';
  prom += `vista_sequence_gap_total ${snap.counters.vista_sequence_gap_total}\n\n`;

  prom += '# HELP vista_drift_detected_total Total distribution drifts detected\n';
  prom += '# TYPE vista_drift_detected_total counter\n';
  prom += `vista_drift_detected_total ${snap.counters.vista_drift_detected_total}\n\n`;

  prom += '# HELP vista_decision_blocked_total Total decisions blocked by policy gate\n';
  prom += '# TYPE vista_decision_blocked_total counter\n';
  prom += `vista_decision_blocked_total ${snap.counters.vista_decision_blocked_total}\n\n`;

  prom += '# HELP vista_attribution_total Total attributions by class\n';
  prom += '# TYPE vista_attribution_total counter\n';
  for (const [cls, count] of Object.entries(snap.counters.vista_attribution_total)) {
    prom += `vista_attribution_total{class="${cls}"} ${count}\n`;
  }
  prom += '\n';

  prom += '# HELP vista_veracity_latency_ms Veracity calculation latency\n';
  prom += '# TYPE vista_veracity_latency_ms gauge\n';
  prom += `vista_veracity_latency_ms{quantile="0.5"} ${snap.veracityLatency.p50}\n`;
  prom += `vista_veracity_latency_ms{quantile="0.95"} ${snap.veracityLatency.p95}\n`;
  prom += `vista_veracity_latency_ms{quantile="0.99"} ${snap.veracityLatency.p99}\n\n`;

  res.setHeader('Content-Type', 'text/plain; version=0.0.4');
  res.status(200).send(prom);
});

module.exports = router;
