// VISTA Prometheus & In-Memory Metrics Registry
class MetricsRegistry {
  constructor() {
    this.counters = {
      vista_ingest_events_total: 0,
      vista_duplicate_events_total: 0,
      vista_sequence_gap_total: 0,
      vista_drift_detected_total: 0,
      vista_decision_blocked_total: 0,
      vista_decision_allowed_total: 0,
      vista_decision_review_total: 0,
      vista_attribution_total: {
        VEHICLE: 0,
        TELEMETRY: 0,
        CONTRACT: 0,
        UNKNOWN: 0,
      },
    };

    this.histograms = {
      vista_veracity_latency_ms: [],
      vista_api_request_duration_ms: [],
    };

    this.gauges = {
      vista_kafka_consumer_lag: 0,
      vista_active_incidents: 0,
      vista_connected_vehicles: 100000,
    };
  }

  inc(metric, val = 1, labels = {}) {
    if (metric === 'vista_attribution_total' && labels.class) {
      if (this.counters.vista_attribution_total[labels.class] !== undefined) {
        this.counters.vista_attribution_total[labels.class] += val;
      }
      return;
    }
    if (this.counters[metric] !== undefined) {
      this.counters[metric] += val;
    }
  }

  setGauge(metric, val) {
    if (this.gauges[metric] !== undefined) {
      this.gauges[metric] = val;
    }
  }

  observe(histogram, val) {
    if (this.histograms[histogram]) {
      this.histograms[histogram].push(val);
      if (this.histograms[histogram].length > 1000) {
        this.histograms[histogram].shift();
      }
    }
  }

  getSnapshot() {
    const calcPercentiles = (arr) => {
      if (!arr.length) return { p50: 0, p95: 0, p99: 0, mean: 0 };
      const sorted = [...arr].sort((a, b) => a - b);
      const p50 = sorted[Math.floor(sorted.length * 0.5)];
      const p95 = sorted[Math.floor(sorted.length * 0.95)];
      const p99 = sorted[Math.floor(sorted.length * 0.99)];
      const mean = (sorted.reduce((a, b) => a + b, 0) / sorted.length).toFixed(2);
      return { p50, p95, p99, mean: Number(mean) };
    };

    return {
      counters: this.counters,
      gauges: this.gauges,
      veracityLatency: calcPercentiles(this.histograms.vista_veracity_latency_ms),
      apiLatency: calcPercentiles(this.histograms.vista_api_request_duration_ms),
      timestamp: new Date().toISOString(),
    };
  }
}

const metrics = new MetricsRegistry();
module.exports = metrics;
