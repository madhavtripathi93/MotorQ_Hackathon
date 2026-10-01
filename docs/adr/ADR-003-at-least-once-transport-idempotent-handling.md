# ADR-003: At-Least-Once Transport and Deterministic Idempotent Processing

## Status
Accepted (Locked Execution Plan)

## Context
Automotive cellular telemetry operates over lossy, fluctuating wireless networks. Vehicles transit through tunnels, cell tower handoffs, and intermittent packet drops. Telematics control units (TCUs) buffer unsent frames and replay them in sudden bursts upon reconnecting.

Additionally, distributed stream processing across Kafka partitions and broker restarts naturally generates duplicate deliveries under at-least-once semantics. Claiming blanket end-to-end "exactly-once" across mobile devices, brokers, and distributed databases is physically impossible and misleading.

## Decision
1. **At-Least-Once Transport**:
   - The messaging backbone enforces at-least-once delivery with producer acks (`acks=all` or `acks=1` with retry backoff) and consumer offset commits only after state persistence or down-stream publishing.
2. **Deterministic Idempotency Key**:
   - Every event generates an immutable idempotency key:
     `IdempotencyKey = SHA256(vin + ":" + seq + ":" + event_type)`
   - Duplicate detection path:
     - Worker checks Redis set `vista:dedup:{vin}` with sliding window TTL (e.g. 300s).
     - If key exists in Redis: classify event as `PIPELINE_DUPLICATE`, record deduplication evidence, increment metric `vista_duplicate_events_total`, and suppress duplicate downstream business side-effects.
     - If key is new: add to Redis set, proceed through veracity engine.
3. **Sequence Ordering & Gap Detection**:
   - Per-VIN state tracks `lastSeenSequence`.
   - If `seq <= lastSeenSequence`: mark as `PIPELINE_REORDER` / late event.
   - If `seq > lastSeenSequence + 1`: mark as `PIPELINE_DROP` / sequence gap, record gap evidence, and increment metric `vista_sequence_gap_total`.
   - Update `lastSeenSequence = max(lastSeenSequence, seq)`.

## Consequences
- **Positive**: Complete robustness against network retries, broker rebalances, and replayed simulator batches.
- **Traceability**: Deduplications and gaps are not silently swallowed; they are explicitly cataloged as pipeline integrity evidence that informs the confidence of subsequent trust evaluations.
