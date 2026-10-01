-- VISTA Relational 3NF Schema (PostgreSQL)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Fleets Table
CREATE TABLE IF NOT EXISTS fleet (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fleet_tenant ON fleet(tenant_id);

-- 2. Vehicles Table
CREATE TABLE IF NOT EXISTS vehicle (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id TEXT NOT NULL,
    vin TEXT NOT NULL UNIQUE,
    fleet_id UUID REFERENCES fleet(id) ON DELETE SET NULL,
    oem TEXT NOT NULL,
    model TEXT NOT NULL,
    year INT NOT NULL,
    firmware_version TEXT NOT NULL,
    last_telemetry_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vehicle_tenant_vin ON vehicle(tenant_id, vin);
CREATE INDEX IF NOT EXISTS idx_vehicle_firmware ON vehicle(firmware_version);

-- 3. Signal Contracts Table
CREATE TABLE IF NOT EXISTS signal_contract (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    canonical_name TEXT NOT NULL,
    semantic_version INT NOT NULL,
    unit TEXT NOT NULL,
    source_ecu TEXT,
    sampling_hz NUMERIC(10,3),
    min_value NUMERIC,
    max_value NUMERIC,
    semantics_json JSONB NOT NULL,
    active_from TIMESTAMPTZ NOT NULL,
    active_to TIMESTAMPTZ,
    UNIQUE (canonical_name, semantic_version)
);
CREATE INDEX IF NOT EXISTS idx_signal_contract_lookup ON signal_contract(canonical_name, semantic_version);
CREATE INDEX IF NOT EXISTS idx_signal_contract_active ON signal_contract(canonical_name, active_from);

-- 4. Contract Mappings Table (OEM Field Normalization)
CREATE TABLE IF NOT EXISTS contract_mapping (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_id UUID NOT NULL REFERENCES signal_contract(id) ON DELETE CASCADE,
    oem TEXT NOT NULL,
    source_field TEXT NOT NULL,
    transform_expr TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_contract_mapping_oem ON contract_mapping(contract_id, oem);

-- 5. Contract Changes Table
CREATE TABLE IF NOT EXISTS contract_change (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    canonical_name TEXT NOT NULL,
    old_version INT NOT NULL,
    new_version INT NOT NULL,
    diff_json JSONB NOT NULL,
    change_ticket TEXT,
    released_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_contract_change_lookup ON contract_change(canonical_name, released_at DESC);

-- 6. Signal Dependencies Table (Cross-signal Invariants)
CREATE TABLE IF NOT EXISTS signal_dependency (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    signal_name TEXT NOT NULL,
    depends_on_signal TEXT NOT NULL,
    relation_type TEXT NOT NULL,
    invariant_config JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_signal_dependency_rel ON signal_dependency(signal_name, depends_on_signal);

-- 7. Vehicle Software History Table (Cohort Attribution)
CREATE TABLE IF NOT EXISTS vehicle_software (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vin TEXT NOT NULL,
    firmware_version TEXT NOT NULL,
    campaign_id TEXT,
    deployed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vehicle_software_lookup ON vehicle_software(vin, deployed_at DESC);
CREATE INDEX IF NOT EXISTS idx_vehicle_software_campaign ON vehicle_software(campaign_id);

-- 8. Incidents Table
CREATE TABLE IF NOT EXISTS incident (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id TEXT NOT NULL,
    vin TEXT NOT NULL,
    signal_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'OPEN',
    severity TEXT NOT NULL DEFAULT 'MEDIUM',
    cause_attribution TEXT NOT NULL DEFAULT 'UNKNOWN',
    trust_score NUMERIC(5,4) NOT NULL DEFAULT 1.0,
    confidence NUMERIC(5,4) NOT NULL DEFAULT 1.0,
    ota_campaign_id TEXT,
    harm_estimate JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_incident_tenant_status_keyset ON incident(tenant_id, status, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_incident_vin_created ON incident(vin, created_at DESC);

-- 9. Incident Evidence Table
CREATE TABLE IF NOT EXISTS incident_evidence (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    incident_id UUID NOT NULL REFERENCES incident(id) ON DELETE CASCADE,
    evidence_code TEXT NOT NULL,
    description TEXT NOT NULL,
    payload JSONB DEFAULT '{}'::jsonb,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_incident_evidence_fk ON incident_evidence(incident_id);

-- 10. Decisions Table
CREATE TABLE IF NOT EXISTS decision (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    decision_id TEXT NOT NULL UNIQUE,
    tenant_id TEXT NOT NULL,
    vin TEXT NOT NULL,
    incident_id UUID REFERENCES incident(id) ON DELETE SET NULL,
    requested_action TEXT NOT NULL,
    outcome TEXT NOT NULL,
    policy_code TEXT NOT NULL,
    trust_threshold NUMERIC(5,4) NOT NULL,
    actual_trust NUMERIC(5,4) NOT NULL,
    reason_details JSONB NOT NULL DEFAULT '{}'::jsonb,
    actor TEXT NOT NULL,
    evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_decision_tenant_evaluated ON decision(tenant_id, evaluated_at DESC);
CREATE INDEX IF NOT EXISTS idx_decision_incident ON decision(incident_id);

-- 11. Audit Log Table (Chained Append-Only)
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    action_type TEXT NOT NULL,
    target_resource TEXT NOT NULL,
    evidence_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    hash_signature TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_log_tenant_actor ON audit_log(tenant_id, actor_id, created_at DESC);
