# VISTA Architecture Specification

## 1. System Overview
VISTA (Vehicle Intelligence Signal Trust & Assurance) continuously determines whether connected-vehicle telemetry is trustworthy enough to drive downstream automated decisions.

```mermaid
graph TD
    subgraph Data Sources
        SIM[Chaos Simulator 100K+ VINs]
        VEH[Connected Vehicles / TCUs]
    end

    subgraph Messaging Backbone
        RAW[telemetry.raw.v1]
        NORM[telemetry.normalized.v1]
        VER[telemetry.veracity.v1]
        QUAR[telemetry.quarantine.v1]
        INC[incidents.v1]
        DEC[decisions.v1]
        AUDIT[audit.v1]
    end

    subgraph Data Plane: Veracity Engine
        FLINK[Flink / Sharded Veracity Workers]
        P1[1. Schema Check]
        P2[2. Sequence & Dedup]
        P3[3. Plausibility Check]
        P4[4. Freshness SLA]
        P5[5. Cross-Signal Invariant]
        P6[6. Distribution Drift JSD]
        P7[7. Cohort Attribution]
        P8[8. Trust Fusion & Calibration]
        P9[9. Decision Gating Engine]
    end

    subgraph Polyglot Storage
        PG[(PostgreSQL 3NF Core)]
        CH[(ClickHouse Windowed Telemetry)]
        RD[(Redis Hot State & Dedup)]
        S3[(MinIO / S3 Object Store)]
    end

    subgraph Control Plane: Node.js 24 API
        API[Express Controller + Service + Repository]
        SEC[JWT Auth & RBAC Middleware]
        GATE[Policy Decision Gateway]
        AGENT[AI Investigation Agent with Guardrails]
        WS[Socket.IO Real-time Hub]
    end

    subgraph Batch Analytics
        BATCH[Batch Attribution & DiD Worker]
    end

    subgraph Presentation Tier
        WEB[Enterprise Web Dashboard]
    end

    SIM -->|vin_hash| RAW
    VEH -->|vin_hash| RAW
    RAW --> FLINK
    FLINK --> P1 --> P2 --> P3 --> P4 --> P5 --> P6 --> P7 --> P8 --> P9
    FLINK -->|Canonical| NORM
    FLINK -->|Trust Score| VER
    FLINK -->|Uncertain/Quarantined| QUAR
    FLINK -->|Actionable Findings| INC
    FLINK --> RD
    FLINK --> CH

    BATCH --> CH
    BATCH -->|Cohort Attribution| INC
    BATCH --> PG

    API --> PG
    API --> RD
    API --> CH
    API --> WS
    WS --> WEB
    API --> WEB
    GATE --> DEC
    GATE --> AUDIT
    AGENT -.->|Read-Only Tools| API
    AGENT -.->|Propose Action| GATE
```

## 2. Core Pipeline
```
RAW TELEMETRY -> DETECT -> ATTRIBUTE -> QUANTIFY HARM -> TRUST -> DECISION GATE -> ACTION
```

### Attribution Classes
1. `VEHICLE`: Physical vehicle event corroborated across multiple independent signals (e.g. regenerative braking showing coordinated speed drop, battery current spike, and accelerometer decel).
2. `TELEMETRY`: Sensor failure, bus fault, or network corruption (e.g. sudden 400 km/h speed reading while RPM and odometer remain constant).
3. `CONTRACT`: Semantic drift due to unannounced OTA firmware change, unit rescaling (e.g. SoC 0-100 -> 0-1), or enum mutation.
4. `UNKNOWN`: Inconclusive evidence; flagged for human operator review or automated re-sampling.

## 3. High-Level Guarantees
- **LLM Guardrail**: The AI never decides trust. All trust scores, policies, and gate decisions are strictly deterministic and cryptographically auditable.
- **Latency**: Sub-5 second detection on critical signal drift.
- **Throughput**: Scalable to 100,000+ events/second via partitioned Kafka keying (`vin_hash`).
- **Resilience**: Graceful broker/worker shutdown and automatic sequence gap reconciliation.
