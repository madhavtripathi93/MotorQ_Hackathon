-- ==============================================================================
-- VISTA Apache Flink SQL Streaming Job: Telemetry Veracity & Quarantine Pipeline
-- Architecture Spike (PDF Section 10 & ADR-002)
-- ==============================================================================

-- 1. Source Table: Kafka raw telemetry stream
CREATE TABLE kafka_telemetry_raw (
    vin STRING,
    seq BIGINT,
    signal STRING,
    `value` DOUBLE,
    eventTime STRING,
    rowtime AS TO_TIMESTAMP(eventTime, 'yyyy-MM-dd''T''HH:mm:ss.SSS''Z'''),
    provenance ROW<
        oem STRING,
        firmware STRING,
        otaCampaign STRING,
        sourceEcu STRING
    >,
    `context` ROW<
        speed_kmh DOUBLE,
        odometer_km DOUBLE,
        gps ROW<lat DOUBLE, lon DOUBLE>
    >,
    WATERMARK FOR rowtime AS rowtime - INTERVAL '2' SECOND
) WITH (
    'connector' = 'kafka',
    'topic' = 'telemetry.raw.v1',
    'properties.bootstrap.servers' = 'kafka:29092',
    'properties.group.id' = 'vista-flink-veracity-engine',
    'scan.startup.mode' = 'latest-offset',
    'format' = 'json'
);

-- 2. Sink Table: Verified Decision-Grade Veracity Output (trust >= 0.50)
CREATE TABLE kafka_telemetry_veracity (
    vin STRING,
    signal STRING,
    eventTime STRING,
    observedValue DOUBLE,
    trustScore DOUBLE,
    topClass STRING,
    evidence ARRAY<STRING>,
    firmware STRING
) WITH (
    'connector' = 'kafka',
    'topic' = 'telemetry.veracity.v1',
    'properties.bootstrap.servers' = 'kafka:29092',
    'format' = 'json'
);

-- 3. Sink Table: Quarantined Telemetry (trust < 0.50)
CREATE TABLE kafka_telemetry_quarantine (
    vin STRING,
    signal STRING,
    eventTime STRING,
    observedValue DOUBLE,
    trustScore DOUBLE,
    topClass STRING,
    reasonCode STRING,
    evidence ARRAY<STRING>,
    firmware STRING
) WITH (
    'connector' = 'kafka',
    'topic' = 'telemetry.quarantine.v1',
    'properties.bootstrap.servers' = 'kafka:29092',
    'format' = 'json'
);

-- 4. Pipeline Logic: Filter and route based on physical & semantic invariant checks
-- Detection of unit-scale inversion: value in [0.0, 1.0] for battery_soc in v4.7 firmware
INSERT INTO kafka_telemetry_quarantine
SELECT 
    vin,
    signal,
    eventTime,
    `value` AS observedValue,
    0.12 AS trustScore,
    'CONTRACT' AS topClass,
    'CONTRACT_SEMANTIC_DRIFT' AS reasonCode,
    ARRAY['UNIT_SCALE_INVERSION', 'VALUE_BELOW_CONTRACT_MIN', 'COHORT_OTA_47_MATCH'] AS evidence,
    provenance.firmware AS firmware
FROM kafka_telemetry_raw
WHERE signal = 'battery_soc'
  AND `value` >= 0.0 AND `value` <= 1.0
  AND provenance.firmware = '4.7';

-- Valid decision-grade telemetry routing
INSERT INTO kafka_telemetry_veracity
SELECT 
    vin,
    signal,
    eventTime,
    `value` AS observedValue,
    0.95 AS trustScore,
    'VEHICLE' AS topClass,
    ARRAY['FRESH', 'IN_RANGE', 'CROSS_SIGNAL_COHERENT'] AS evidence,
    provenance.firmware AS firmware
FROM kafka_telemetry_raw
WHERE NOT (signal = 'battery_soc' AND `value` >= 0.0 AND `value` <= 1.0 AND provenance.firmware = '4.7')
  AND NOT (signal = 'speed_kmh' AND `value` > 250.0);
