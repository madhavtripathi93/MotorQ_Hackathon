# ADR-002: Node.js Control Plane and Streaming Data Plane Architecture

## Status
Accepted (Locked Execution Plan)

## Context
Connected vehicle intelligence at scale (100K+ concurrent VINs emitting at 1 Hz, generating 100,000+ events/sec, with 3x peak bursts) requires high computational throughput, low latency (<5s critical alerts), and reliable stateful windowing.

At the same time, the platform requires enterprise API features: Express/MVC modular architecture, JWT/OIDC authentication, role-based access control, tenant isolation, OpenTelemetry instrumentation, Socket.IO live streaming, semantic contract management, and scenario orchestrations.

Mixing CPU-heavy streaming analytics directly into the Express API event loop would cause event loop starvation, degraded API p99 latency, and dropped WebSocket connections.

## Decision
1. **Control Plane (Node.js 24 LTS + Express)**:
   - Owns the REST API, WebSocket server, tenant authentication, contract registry, decision gateway, and audit log.
   - Follows Controller -> Service -> Repository pattern.
   - Controllers never perform trust math or directly issue raw SQL.
   - Uses Socket.IO to push derived trust state changes and incidents to the UI—never raw 100K events/sec.

2. **Data Plane Boundary (Kafka Topics)**:
   - Uses Kafka as the durable, partitioned, replayable event backbone (`telemetry.raw.v1`, `telemetry.normalized.v1`, `telemetry.veracity.v1`, `telemetry.quarantine.v1`, `incidents.v1`, `decisions.v1`, `audit.v1`).
   - Partitioning key is `vin_hash` ensuring all sequential telemetry from any single vehicle is processed in strict order.

3. **Stream Processing (Flink Spike & Node.js Worker Fallback)**:
   - The primary high-volume data plane is designed for Apache Flink stateful streaming.
   - To guard against operational delivery risk, a high-throughput Node.js worker-sharded veracity pipeline is implemented behind the exact same Kafka topic contracts.
   - The contract abstraction ensures that either engine (Flink or Node worker pool) can be plugged in without changing the control plane or simulator.

## Consequences
- **Positive**: Strict isolation of concerns. API event loop remains responsive (p99 < 50ms) even under 100K+ event/sec telemetry ingestion.
- **Resilience**: Data plane workers can be scaled horizontally or restarted independently of the API gateway.
- **Graceful Degradation**: If Kafka or stream workers experience lag, non-stream control endpoints and human operator decision paths remain operational.
