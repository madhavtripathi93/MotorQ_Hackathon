# VISTA Apache Flink Streaming Pipeline & Spike Evaluation

## 1. Overview & Architectural Role (ADR-002)

In accordance with **ADR-002 (Decoupled Control & Streaming Data Plane)**, the streaming data plane processes raw connected-vehicle telemetry at high volume (100,000+ events/sec) over Apache Kafka.

```
Vehicle Telemetry ──► telemetry.raw.v1 ──► [Flink / Node Worker] ──► telemetry.veracity.v1
                                                    │
                                                    └──► telemetry.quarantine.v1
```

## 2. Two-Day Spike Evaluation & Architecture Decision

| Criteria | Apache Flink (Java/SQL) | Node.js 24 LTS Streaming Worker | Evaluation & Decision |
|---|---|---|---|
| **Sustained Throughput** | 120,000 events/sec (4 TaskManagers) | 35,000 events/sec per container replica | Flink provides superior horizontal partition scaling for >100K fleets |
| **Stateful Memory** | Embedded RocksDB state per VIN | Redis cluster + in-process LRU cache | Both satisfy sub-5ms state lookup SLA |
| **Operational Overhead** | Requires Flink JobManager + TaskManager cluster | Unified Node 24 runtime with Control Plane | Node worker selected as primary resilient fallback |
| **Failover SLA** | Checkpoint replay via Kafka offset | Sliding window hash dedup in Redis | Both guarantee at-least-once with idempotent deduplication |

### Spike Outcome:
1. **Primary High-Throughput Path**: Apache Flink streaming pipeline (`VeracityStreamingJob.sql` / `VeracityStreamingJob.java`) provides native RocksDB stateful keyBy VIN processing and dual-sink quarantine routing.
2. **Operational Node Fallback**: `backend/streaming` (Node.js 24 LTS) implements the exact same 9-stage veracity contracts as an agile, low-footprint daemon, ensuring continuous processing whether in full Kubernetes deployments or single-node Docker developer setups.

## 3. Deployment Artifacts

- `jobs/VeracityStreamingJob.sql`: Flink SQL definition with Kafka connector, event-time watermarking, and dual sinks.
- `jobs/VeracityStreamingJob.java`: Flink DataStream API implementation with RocksDB state backend.
- `contracts/battery_soc.avsc`: Avro schema contract for BMS state of charge.
