const crypto = require('crypto');
const redis = require('../shared/redis');
const metrics = require('../observability/metrics');

// In-memory sequence tracker for fallback/speed
const vinLastSequenceMap = new Map();

async function validateSequence(event) {
  const { vin, seq, signal = 'telemetry' } = event;
  const evidence = [];
  let isDuplicate = false;
  let isReordered = false;
  let hasGap = false;

  const dedupKey = `vista:dedup:${vin}`;
  const idempotencyHash = crypto.createHash('sha256')
    .update(`${vin}:${seq}:${signal}`)
    .digest('hex')
    .slice(0, 16);

  try {
    const isMember = await redis.sismember(dedupKey, idempotencyHash);
    if (isMember) {
      isDuplicate = true;
      evidence.push('PIPELINE_DUPLICATE');
      metrics.inc('vista_duplicate_events_total');
      return {
        isDuplicate: true,
        isReordered: false,
        hasGap: false,
        evidence,
        integrityScore: 0.1,
      };
    }

    // Add to dedup window (TTL 300s)
    await redis.sadd(dedupKey, idempotencyHash);
    await redis.expire(dedupKey, 300);
  } catch (err) {
    // Graceful fallback
  }

  // Sequence order evaluation
  const lastSeen = vinLastSequenceMap.get(vin);

  if (lastSeen !== undefined) {
    if (seq <= lastSeen) {
      isReordered = true;
      evidence.push('PIPELINE_REORDER');
    } else if (seq > lastSeen + 1) {
      hasGap = true;
      const missed = seq - lastSeen - 1;
      evidence.push(`SEQUENCE_GAP_${missed}_EVENTS`);
      metrics.inc('vista_sequence_gap_total', missed);
    } else {
      evidence.push('SEQUENCE_MONOTONIC');
    }
  } else {
    evidence.push('SEQUENCE_INITIALIZED');
  }

  vinLastSequenceMap.set(vin, Math.max(lastSeen || 0, seq));

  const integrityScore = isDuplicate ? 0.0 : isReordered ? 0.7 : hasGap ? 0.8 : 1.0;

  return {
    isDuplicate,
    isReordered,
    hasGap,
    evidence,
    integrityScore,
  };
}

module.exports = { validateSequence };
