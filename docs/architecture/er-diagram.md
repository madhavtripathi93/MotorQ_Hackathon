# VISTA Entity-Relationship (ER) & Schema Specification

## 1. Relational 3NF Model (PostgreSQL)

```mermaid
erDiagram
    FLEET ||--o{ VEHICLE : owns
    VEHICLE ||--o{ VEHICLE_SOFTWARE : tracks
    VEHICLE ||--o{ INCIDENT : generates
    VEHICLE ||--o{ DECISION : subject_to
    SIGNAL_CONTRACT ||--o{ CONTRACT_MAPPING : maps
    SIGNAL_CONTRACT ||--o{ CONTRACT_CHANGE : versions
    SIGNAL_CONTRACT ||--o{ SIGNAL_DEPENDENCY : requires
    INCIDENT ||--o{ INCIDENT_EVIDENCE : contains
    INCIDENT ||--o{ DECISION : triggers
    DECISION ||--o{ AUDIT_LOG : generates

    FLEET {
        uuid id PK
        string tenant_id
        string name
        jsonb metadata
        timestamptz created_at
    }

    VEHICLE {
        uuid id PK
        string vin UK
        uuid fleet_id FK
        string tenant_id
        string oem
        string model
        int year
        string current_firmware
        timestamptz last_telemetry_at
    }

    SIGNAL_CONTRACT {
        uuid id PK
        string canonical_name
        int semantic_version
        string unit
        string source_ecu
        numeric sampling_hz
        numeric min_value
        numeric max_value
        jsonb semantics_json
        timestamptz active_from
        timestamptz active_to
    }

    CONTRACT_MAPPING {
        uuid id PK
        uuid contract_id FK
        string oem
        string source_field
        string transform_expr
        timestamptz created_at
    }

    CONTRACT_CHANGE {
        uuid id PK
        string canonical_name
        int old_version
        int new_version
        jsonb diff_json
        string change_ticket
        timestamptz released_at
    }

    SIGNAL_DEPENDENCY {
        uuid id PK
        string signal_name
        string depends_on_signal
        string relation_type
        jsonb invariant_config
    }

    VEHICLE_SOFTWARE {
        uuid id PK
        string vin FK
        string firmware_version
        string campaign_id
        timestamptz deployed_at
    }

    INCIDENT {
        uuid id PK
        string tenant_id
        string vin FK
        string signal_name
        string status
        string severity
        string cause_attribution
        numeric trust_score
        numeric confidence
        string ota_campaign_id
        jsonb harm_estimate
        timestamptz created_at
        timestamptz resolved_at
    }

    INCIDENT_EVIDENCE {
        uuid id PK
        uuid incident_id FK
        string evidence_code
        string description
        jsonb payload
        timestamptz recorded_at
    }

    DECISION {
        uuid id PK
        string decision_id UK
        string tenant_id
        string vin FK
        uuid incident_id FK
        string requested_action
        string outcome
        string policy_code
        numeric trust_threshold
        numeric actual_trust
        jsonb reason_details
        string actor
        timestamptz evaluated_at
    }

    AUDIT_LOG {
        uuid id PK
        string tenant_id
        string actor_id
        string action_type
        string target_resource
        jsonb evidence_snapshot
        string hash_signature
        timestamptz created_at
    }
```

## 2. Columnar Analytics Model (ClickHouse)

```sql
CREATE TABLE telemetry_windowed (
    vin_hash String,
    ts DateTime64(3),
    signal_name LowCardinality(String),
    value Float64,
    trust_score Float32,
    firmware_version LowCardinality(String),
    contract_version LowCardinality(String),
    scenario_id String
)
ENGINE = MergeTree
PARTITION BY toYYYYMMDD(ts)
ORDER BY (vin_hash, ts)
TTL ts + INTERVAL 30 DAY TO VOLUME 'warm',
    ts + INTERVAL 180 DAY DELETE;
```

### Partition & Sort Key Justification
- `ORDER BY (vin_hash, ts)`: Aligns on disk with the primary access pattern: looking up chronological sensor history for a single vehicle during incident investigation and veracity window calculation.
- `PARTITION BY toYYYYMMDD(ts)`: Enables instantaneous drop/detach of old data partitions and isolates high-frequency daily batches.
- `TTL`: Automates multi-tiered cold storage offloading to MinIO/S3 after 30 days and pruning after 180 days.
