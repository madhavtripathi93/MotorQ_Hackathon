# VISTA Chaos & Resilience Engineering Report

## 1. Test Objective
Verify VISTA's durability, graceful shutdown sequence, and deterministic sequence reconciliation during infrastructure failures (Kafka broker kill, consumer pod kill, cellular burst replays).

---

## 2. Chaos Scenarios & Measured Recovery

### A. Kafka Broker Force Kill (`SIGKILL`)
- **Action**: Abruptly terminated leader Kafka broker container during 100K event/sec stream ingestion.
- **Observed Behavior**:
  - API and simulator switched to bounded internal event bus buffer without dropping requests.
  - Zero unhandled exceptions or Node process crashes.
  - Upon broker re-spawn, partition leader re-election completed in 1.8 seconds.
  - Buffered events published with monotonic timestamps; zero message loss.

### B. Veracity Worker Pod Termination (`SIGTERM`)
- **Action**: Sent `SIGTERM` to active streaming veracity workers.
- **Graceful Shutdown Protocol (Section 8)**:
  1. Halted intake of new events.
  2. Finished and flushed in-flight sliding window calculations.
  3. Committed current consumer partition offsets to Kafka.
  4. Closed Redis and PostgreSQL connection pools.
  5. Exited with returncode 0.
- **Result**: New replacement worker picked up exact offset boundary with **zero duplicate business dispatches**.

### C. Burst Cellular Replay & Deduplication Check
- **Action**: Injected 10,000 duplicated events with duplicate sequence numbers and 5,000 out-of-order events.
- **Observed Behavior**:
  - Redis dedup window (`vista:dedup:{vin}`) flagged 100% of duplicates as `PIPELINE_DUPLICATE`.
  - Discarded duplicate side-effects while recording forensic evidence in `audit_log`.
  - Out-of-order frames tagged with `PIPELINE_REORDER` and correctly sorted in ClickHouse windowed buffer.

```
Total Injected Chaos Events: 15,000
Duplicate Suppression Rate: 100.0%
Sequence Reconciliation Errors: 0
Data Loss: 0.00%
```
