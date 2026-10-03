-- VISTA ClickHouse Telemetry Windowed Schema

CREATE DATABASE IF NOT EXISTS vista;

CREATE TABLE IF NOT EXISTS vista.telemetry_windowed (
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

CREATE TABLE IF NOT EXISTS vista.telemetry_features (
    vin_hash String,
    window_start DateTime64(3),
    window_end DateTime64(3),
    signal_name LowCardinality(String),
    firmware_version LowCardinality(String),
    campaign_id LowCardinality(String),
    is_treatment UInt8,
    mean_val Float64,
    std_val Float64,
    min_val Float64,
    max_val Float64,
    count_val UInt32,
    missing_count UInt32,
    jsd_drift Float32,
    plausibility_rate Float32
)
ENGINE = MergeTree
PARTITION BY toYYYYMMDD(window_start)
ORDER BY (signal_name, firmware_version, window_start);
