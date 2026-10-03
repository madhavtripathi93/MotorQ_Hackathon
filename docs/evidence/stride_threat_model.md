# VISTA STRIDE Threat Model & Security Evaluation

| Component | Threat Category | Threat Description | Mitigation in VISTA | Validation Evidence |
|---|---|---|---|---|
| **API Control Plane** | **Spoofing** | Unauthorized client calls control/scenario endpoints | JWT authentication with HMAC-SHA256 / RSA signatures, constant-time validation | Test: `tests/contract/auth.test.js` rejects missing/forged tokens |
| **API Control Plane** | **Tampering** | Modified request payload or altered contract schema | Zod runtime schema validation, TLS encryption, strict input sanitization | Inbound payload schema enforcement rejects unexpected fields |
| **API Control Plane** | **Repudiation** | Operator denies triggering an emergency stop or contract override | Immutable `audit_log` with actor identity, timestamp, hash signature, and reason | Audit records emitted to `audit.v1` and persisted in 3NF table |
| **API Control Plane** | **Information Disclosure** | Leakage of vehicle telemetry across tenants | Strict multi-tenant isolation middleware filtering queries by `tenant_id` | Socket.IO room-level tenant isolation, SQL where clause filters |
| **API Control Plane** | **Denial of Service** | Flooding API with repetitive scenario/decision requests | `express-rate-limit` + Redis distributed rate-limiting counters | Returns HTTP 429 upon exceeding burst thresholds |
| **API Control Plane** | **Elevation of Privilege** | Read-only analyst role attempting to activate semantic contracts | RBAC middleware enforcing `role: 'admin' \| 'operator'` | Non-admin returns HTTP 403 Forbidden |
| **Kafka Broker** | **Tampering / Injection** | Rogue simulator injecting fabricated high-veracity telemetry | Partitioning keyed by `vin_hash`, HMAC sequence checking, mTLS broker auth | Veracity engine flags signature & sequence anomalies |
| **Kafka Broker** | **Replay Attacks** | Capturing and replaying previous valid telemetry batches | Redis deduplication window `vista:dedup:{vin}` with monotonic sequence verification | Duplicate events classified as `PIPELINE_DUPLICATE` and discarded |
| **AI Investigation Agent**| **Elevation / Bypass** | Prompt injection inducing AI to override a safety block | **ADR-001**: LLM never decides trust; decisions evaluated by deterministic policy gateway | `DecisionService.evaluate()` strictly blocks low-trust actions |
| **Storage (Postgres / ClickHouse)** | **Information Disclosure** | Location tracking and VIN deanonymization in analytics | Hashed VINs (`vin_hash`), geo-location precision truncation (masking to ~1km) | `docs/evidence/compliance.md` location pseudonymization |
| **Web UI** | **Cross-Site Scripting (XSS)**| Injected script inside vehicle telemetry status field | Strict React DOM escaping, Content Security Policy (CSP) headers via Helmet | Helmet headers verified in HTTP responses |
