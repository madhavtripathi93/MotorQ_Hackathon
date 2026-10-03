# ADR-004: Polyglot Storage Architecture (PostgreSQL + ClickHouse + Redis + S3/MinIO)

## Status
Accepted (Locked Execution Plan)

## Context
Connected vehicle data has sharply conflicting access patterns:
1. **Relational Control Metadata**: Fleets, vehicles, drivers, signal contracts, contract diffs, incidents, decision policies, and audit trails demand 3NF normalization, ACID transactions, foreign keys, and keyset-paginated relational queries.
2. **High-Rate Time-Series Telemetry**: Millions of time-series points per minute requiring ultra-fast column-scans, aggregate statistics (e.g. histograms, percentiles, DiD window sums), and high compression ratios.
3. **Hot In-Memory State**: Sub-millisecond lookups for sequence deduplication, last known trusted state, real-time trust snapshots, and API rate-limiting.
4. **Warm/Cold Archive**: Immutable replay datasets, raw dumps, and long-term evidence bundles.

Attempting to store raw high-frequency telemetry in PostgreSQL leads to severe write amplification, bloated indexes, and degraded API query performance. Conversely, storing relational contracts in a pure time-series database loses referential integrity.

## Decision
Adopt a dedicated polyglot storage architecture:
1. **PostgreSQL (3NF Core)**:
   - Tables: `fleet`, `vehicle`, `signal_contract`, `contract_mapping`, `contract_change`, `signal_dependency`, `vehicle_software`, `incident`, `incident_evidence`, `decision`, `audit_log`, `users`.
   - Strictly normalized schema with indexes on foreign keys, tenant IDs, and keyset pagination cursors.
2. **ClickHouse (Columnar Telemetry Analytics)**:
   - Table: `telemetry_windowed`.
   - Engine: `MergeTree`.
   - Partitioning: `PARTITION BY toYYYYMMDD(ts)`.
   - Sorting Key: `ORDER BY (vin_hash, ts)` matching point lookups and time-range scans per vehicle.
   - Lifecycle: TTL of 30 days to volume 'warm', 180 days delete, with export to Parquet/MinIO.
3. **Redis (Live Hot State)**:
   - `vista:dedup:{vin}`: Short-term sequence sets for duplicate suppression.
   - `vista:last_trusted:{vin}`: Last confirmed valid physical state.
   - `vista:trust:{vin}:{signal}`: Hot trust score snapshot for real-time decision evaluation.
   - `vista:incident:{incidentId}`: Live cache of unresolved incidents.
   - `vista:rate:{tenant}:{route}`: Fixed-window / sliding-window API rate limit counters.
4. **MinIO / S3 Object Store**:
   - Stores raw replay logs, forensic evidence zip archives, and model evaluation bundles.

## Consequences
- **Positive**: PostgreSQL maintains pristine ACID integrity for fleet operations; ClickHouse executes analytical aggregations over 100K+ vehicles in sub-second times; Redis enables <2ms decision gating.
- **Trade-off**: Requires synchronizing state across storage tiers via event-driven Kafka consumers and batch jobs.
