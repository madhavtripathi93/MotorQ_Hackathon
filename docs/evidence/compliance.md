# VISTA Compliance & Privacy Governance (GDPR, CCPA, ISO 21434)

## 1. Location Privacy & Pseudonymization
Connected vehicle telemetry contains high-resolution GPS coordinates that constitute Personally Identifiable Information (PII) under GDPR and California Consumer Privacy Act (CCPA).
VISTA implements dual-tier location masking:
1. **At Ingestion**:
   - `vin` is transformed into an irreversible cryptographic HMAC: `vin_hash = HMAC_SHA256(vin, tenant_salt)`.
   - Raw micro-coordinates (e.g. 37.7749295, -122.4194155) stored in ClickHouse analytics are reduced in precision to 2 decimal places (~1.1 km resolution) unless explicitly under an active geofence recovery mandate.
2. **Access Control**:
   - Unmasked VIN lookup requires explicit `PRIVILEGED_VEHICLE_INVESTIGATOR` scope in the JWT token.
   - All lookups emit a compliance audit record to `audit.v1`.

## 2. Right to Erasure / "Crypto-Shredding" Workflow
When a driver requests data erasure under GDPR Article 17:
1. The tenant-specific salt/key associated with the vehicle identity mapping is securely deleted from the key store.
2. Historical windowed rows in ClickHouse remain cryptographically anonymized and cannot be correlated back to any natural person or physical VIN.
3. Transactional metadata in PostgreSQL (e.g., driver mapping) is cascaded via `DELETE FROM vehicle WHERE vin = :vin;`.
4. Automated test verification: `tests/contract/compliance.test.js` confirms that querying an erased VIN returns 404 and leaves zero personal identifiers.

## 3. Cryptographic Audit Trail
Every decision evaluation, contract activation, and agent query produces an append-only audit event containing:
- `actor_id`: Subject ID of the operator, agent, or service.
- `tenant_id`: Multi-tenant ownership identifier.
- `action_type`: e.g., `DECISION_EVALUATED`, `CONTRACT_ACTIVATED`, `ACTION_BLOCKED`.
- `target_resource`: Resource identifier (e.g., VIN, Incident ID).
- `evidence_snapshot`: The deterministic veracity and trust values at the instant of evaluation.
- `hash_signature`: SHA256 integrity hash chained to the prior log record to prevent log tampering.
