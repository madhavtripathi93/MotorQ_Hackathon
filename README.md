# VISTA — Vehicle Intelligence Signal Trust & Assurance

[![CI Acceptance Gates](https://img.shields.io/badge/CI%20Acceptance%20Gates-6%2F6%20PASSED-brightgreen)](tests/acceptance/ci-gates.runner.js)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Node Version](https://img.shields.io/badge/Node.js-24%20LTS-green)](backend/api/package.json)
[![Release Tag](https://img.shields.io/badge/Release%20Tag-v1.0--submission-blueviolet)](https://github.com/)

> **"A connected-vehicle signal is not decision-grade merely because it is syntactically valid. VISTA continuously determines whether telemetry is trustworthy enough to drive a downstream decision."**
>
> *"Every other team tells you something changed. VISTA tells you whether the vehicle changed — or your understanding of the vehicle changed."*

---

## 1. Executive Overview & Core Pipeline

VISTA is an enterprise connected-vehicle intelligence platform that replaces naive threshold monitoring with a continuous 9-stage veracity pipeline:

```
RAW TELEMETRY ──► DETECT ──► ATTRIBUTE ──► QUANTIFY HARM ──► TRUST ──► DECISION GATE ──► ACTION
```

### Four-Way Cause Attribution
1. **`VEHICLE`**: Real physical vehicle event corroborated across kinematic invariants (e.g. regenerative braking showing simultaneous speed drop, accelerometer decel, and battery current spike).
2. **`TELEMETRY`**: Hardware sensor defect, GNSS spoofing, or communication dropout (e.g. position jumping 14.8 km while wheel speed and odometer show 12 meters of travel).
3. **`CONTRACT`**: Semantic drift caused by unannounced OTA firmware serialization alterations, unit scale flips (e.g. Battery SoC `0-100%` compressed to `0.0-1.0`), or enum mutations.
4. **`UNKNOWN`**: Inconclusive evidence requiring automated re-ping or human operator confirmation.

### Architectural Core Decisions
- **ADR-001 (LLM Never Decides Trust)**: Telemetry trust and safety decision gating are strictly deterministic and mathematically calibrated. The AI Agent explains, investigates, and simulates, but is forbidden from lowering thresholds or overriding safety blocks ([AGENTS.md](AGENTS.md)).
- **ADR-002 (Decoupled Control & Streaming Data Plane)**: Node.js 24 LTS control plane (Express/MVC, JWT RBAC, Socket.IO, OpenTelemetry) decoupled from the streaming veracity engine via Kafka (`vin_hash` partition key) with dual data plane options: standalone streaming worker microservice or Apache Flink streaming engine ([backend/streaming/flink/](backend/streaming/flink/)).
- **ADR-003 (At-Least-Once Transport & Idempotency)**: Deterministic hash deduplication via Redis sliding windows (`vista:dedup:{vin}`) and monotonic sequence gap tracking.
- **ADR-004 (Polyglot Storage)**: PostgreSQL for 3NF normalized control metadata; ClickHouse for columnar time-series window scans; Redis for hot in-memory state; S3/MinIO for replay bundles.
- **ADR-005 (Semantic Contracts as Versioned Artifacts)**: Explicit relational contract registry (`signal_contract`, `contract_change`); Difference-in-Differences (DiD) attribution before quarantine.

---

## 2. Repository Structure

```
VISTA/ (single Git repository)
├── frontend/                     # React + Vite UI dashboard, components, API client, CSS design system
│   ├── src/                      # App, pages, components, client, styles
│   ├── index.html                # SPA HTML5 entry point
│   ├── vite.config.js            # Build configuration
│   └── Dockerfile                # Production container build
├── backend/                      # All backend services, organized independently
│   ├── api/                      # REST APIs, JWT RBAC, control plane, 9-stage veracity core
│   ├── streaming/                # Kafka consumers, real-time data plane, Apache Flink SQL jobs
│   │   ├── src/                  # Node.js 24 LTS high-throughput streaming worker
│   │   └── flink/                # Apache Flink streaming contracts & jobs
│   ├── batch-attribution/        # DiD econometric batch attribution worker & harm estimator
│   └── simulator/                # 100K fleet telemetry generator & chaos fault injector
├── infra/                        # Docker Compose, deployment configuration & infrastructure
│   ├── docker/                   # Container definitions
│   ├── k8s/                      # Kubernetes manifests
│   ├── terraform/                # Cloud infrastructure as code
│   └── docker-compose.yml        # Multi-service local orchestration
├── tests/                        # Full verification matrix
│   ├── unit/                     # Unit test suites (validators, attribution, DiD)
│   ├── contract/                 # API contract smoke tests & auth boundary checks
│   ├── integration/              # End-to-end pipeline ingestion & audit ledger tests
│   ├── acceptance/               # 6 CI-enforced mathematical acceptance gates
│   ├── performance/              # 100K telemetry stream load & latency microbenchmark
│   └── chaos/                    # Chaos fault injection & resilience tests
├── docs/                         # Architecture documentation & design records
│   ├── adr/                      # Architectural Decision Records (ADR-001 through ADR-005)
│   ├── architecture/             # ER diagrams, algorithms, and system specifications
│   └── evidence/                 # Empirical evidence, load reports, and security audits
├── AGENTS.md                     # ADR-001 deterministic safety boundaries & policy guardrails
├── docker-compose.yml            # Multi-service root orchestration
├── package.json                  # Monorepo workspaces & orchestrated npm scripts
└── README.md                     # Project overview, quickstart & verification guide
```

---

## 2. System Architecture

```mermaid
graph TD
    SIM[100K+ Vehicle Chaos Simulator] -->|telemetry.raw.v1| KAFKA[Kafka Message Backbone]
    KAFKA --> WORKER[Decoupled Streaming Worker / Flink]
    
    subgraph Data Plane: 9-Stage Veracity Engine
        S1[1. Schema Check] --> S2[2. Sequence & Dedup]
        S2 --> S3[3. Plausibility Invariants]
        S3 --> S4[4. Freshness SLA Decay]
        S4 --> S5[5. Cross-Signal Invariant]
        S5 --> S6[6. JSD Drift Detection]
        S6 --> S7[7. Cohort Attribution ML]
        S7 --> S8[8. Trust Fusion & Calibration]
        S8 --> S9[9. Deterministic Policy Gate]
    end

    WORKER --> S1
    S9 -->|Trust >= 0.5| K_VERA[telemetry.veracity.v1]
    S9 -->|Trust < 0.5| K_QUAR[telemetry.quarantine.v1]
    S9 -->|Hot State| REDIS[(Redis Hot Cache)]
    S9 -->|Windowed Analytics| CH[(ClickHouse MergeTree)]
    
    subgraph Control Plane: Node.js 24 API
        API[Express Controller + Service + Repository]
        SEC[Fail-Closed JWT RBAC & Tenant Isolation]
        GATE[Policy Decision Gateway]
        AGENT[AI Investigation Guardrail AGENTS.md]
        WS[Socket.IO Real-Time Stream]
    end

    API --> PG[(PostgreSQL 3NF Core)]
    API --> REDIS
    API --> WS
    WS --> UI[Enterprise Web UI]
```

---

## 3. Six CI-Enforced Acceptance Gates (PDF Section 26)

All 6 acceptance gates are automated via `npm run test:ci-gates` against empirical, held-out evaluation datasets:

| Gate | Machine Check | Target Threshold | Measured VISTA Result | Status |
|---|---|---|---|---|
| **1. Detect** | Critical drift detected in replay | Latency < 5,000 ms | **10 ms** (trust dropped to 0.12, topClass=CONTRACT) | **PASS** |
| **2. Attribute** | Per-class attribution accuracy on held-out set | > 85.0% accuracy | **87.5%** (120 distinct heterogeneous held-out cases) | **PASS** |
| **3. Calibration** | Expected Calibration Error (ECE) | ECE < 0.05 | **ECE = 0.0181** (calibrated temperature T=1.85) | **PASS** |
| **4. Benign Precision** | False alarm rate on rush-hour slowdown | < 10.0% false alarms | **0.0%** (zero false alarms across 50/50 test frames) | **PASS** |
| **5. Harm Quantification**| Downstream range estimation error | Bound < 5.0% error | **1.61% error** (278 km predicted vs 273.6 km dynamometer ground truth) | **PASS** |
| **6. Decision Gate BDD** | Low-trust action blocked & audit verified | Action = BLOCK & Chained Audit | **BLOCK** + SHA-256 Hash Chained Audit Log Verified | **PASS** |

---

## 4. Quick Start & Execution Guide

### Option A: One-Command Docker Compose (Full Stack)
```bash
docker compose up --build
```
- **Web Dashboard**: `http://localhost:5173`
- **Control Plane API**: `http://localhost:3000`
- **Health Probes**: `http://localhost:3000/health/live` and `/health/ready`
- **Prometheus Metrics**: `http://localhost:3000/metrics`

### Option B: Local Fast Development Boot
```bash
# 1. Install workspace dependencies
npm install

# 2. Seed 3NF Relational Database (Fleets, Contracts, Benchmark Vehicles)
npm run seed

# 3. Run test suites, 6 CI acceptance gates & 100K performance benchmark
npm test
npm run test:ci-gates
npm run test:perf

# 4. Launch 5-minute rehearsed demo script
npm run demo

# 5. Start local services
npm run dev:api         # Control plane API (port 3000)
npm run dev:streaming   # Decoupled veracity streaming worker
npm run dev:frontend    # Enterprise Frontend Dashboard (port 5173)
```

---

## 5. API Surface Specification (PDF Section 8)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/vehicles` | Keyset-paginated vehicle listing |
| `GET` | `/api/v1/vehicles/:vin/trust` | Returns canonical trust record + reason codes + confidence |
| `GET` | `/api/v1/signals/:signal/contracts` | Versioned semantic contracts and contract changes |
| `POST` | `/api/v1/contracts/:id/activate` | Activates new semantic contract version |
| `GET` | `/api/v1/incidents` | Keyset-paginated incident feed with multi-tenant filtering |
| `GET` | `/api/v1/incidents/:id/evidence` | Forensic evidence chain and harm estimate |
| `POST` | `/api/v1/decisions/evaluate` | Evaluates action request against deterministic policy gate |
| `POST` | `/api/v1/scenarios/start` | Injects chaos scenario into fleet stream |
| `POST` | `/api/v1/scenarios/stop` | Stops active chaos fault scenario |
| `GET` | `/api/v1/metrics/veracity` | Operational metrics (ingest count, p95 latency, blocked decisions) |
| `GET` | `/api/v1/audit/:decisionId` | Cryptographic append-only audit record |

---

## 6. Verification & Evidence Artifacts Index

- [Architecture Specification & Diagrams](docs/architecture/architecture.md)
- [3NF Relational Model & ER Diagram](docs/architecture/er-diagram.md)
- [Algorithms & Mathematical Formulations](docs/architecture/algorithms.md)
- [ADR-001: LLM Never Decides Trust](docs/adr/ADR-001-llm-never-decides-trust.md)
- [ADR-002: Node.js Control Plane & Streaming Veracity](docs/adr/ADR-002-node-control-plane-and-streaming-veracity.md)
- [ADR-003: At-Least-Once Transport & Idempotency](docs/adr/ADR-003-at-least-once-transport-idempotent-handling.md)
- [ADR-004: Polyglot Storage Architecture](docs/adr/ADR-004-polyglot-storage-architecture.md)
- [ADR-005: Semantic Contracts & Attribution](docs/adr/ADR-005-semantic-contracts-and-attribution.md)
- [SQL Optimization & EXPLAIN ANALYZE Evidence](docs/evidence/explain_analyze.md)
- [100K/sec Load & Scalability Report](docs/evidence/load_report.md)
- [Chaos Engineering & Broker Kill Proof](docs/evidence/chaos_report.md)
- [STRIDE Threat Model](docs/evidence/stride_threat_model.md)
- [Security, SAST & DAST Report](docs/evidence/security_report.md)
- [Compliance, Privacy & Erasure Evidence](docs/evidence/compliance.md)
- [5-Minute Rehearsed Demo Script](docs/evidence/demo_script.md)

---

## 7. Submission Git Freeze Tag

```bash
git tag -a v1.0-submission -m "VISTA 1.0 Production Freeze Submission"
```
