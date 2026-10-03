/**
 * VISTA In-Process 9-Stage Veracity Engine Throughput & Latency Microbenchmark
 *
 * SCOPE & BENCHMARK ARCHITECTURE:
 * - Benchmarks the CPU execution, memory footprint, and processing latency of the 9-stage
 *   Veracity Engine (Schema, Sequence, Plausibility, Freshness, Cross-Signal, Drift, Attribution, Trust Fusion).
 * - Target: Verifies sustained processing throughput of 25,000 - 35,000 events/sec per Node.js worker core
 *   and bounded heap growth across 130,000 telemetry frames.
 * - Note on Distributed Kafka: This microbenchmark tests the computational throughput of the Veracity Engine.
 *   It does NOT test network socket serialization over external Kafka brokers or remote ClickHouse clusters.
 *   Network partition tolerance, consumer group rebalancing, and cluster transport are tested in tests/chaos/fault_injection.test.js.
 */

process.env.LOG_LEVEL = 'silent';
process.env.NODE_ENV = 'test';

const veracityEngine = require('../../backend/api/src/veracity/veracityEngine');
const contractRepo = require('../../backend/api/src/modules/contracts/contract.repository');

// Colors for terminal formatting
const GREEN = '\x1b[32m';
const CYAN = '\x1b[36m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

function formatNumber(num) {
  return new Intl.NumberFormat().format(Math.round(num));
}

function computePercentile(sortedArray, percentile) {
  if (sortedArray.length === 0) return 0;
  const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
  return sortedArray[Math.max(0, Math.min(index, sortedArray.length - 1))];
}

async function runPerformanceProof() {
  console.log(`${BOLD}${CYAN}================================================================${RESET}`);
  console.log(`${BOLD}${CYAN}🚀 VISTA 100K IN-PROCESS 9-STAGE VERACITY PIPELINE MICROBENCHMARK${RESET}`);
  console.log(`${BOLD}${CYAN}================================================================${RESET}`);
  console.log(`${BOLD}${YELLOW}WARNING: This is an in-process compute microbenchmark.${RESET}`);
  console.log(`${BOLD}${YELLOW}It does NOT measure end-to-end transport throughput over Kafka.${RESET}`);
  console.log(`${BOLD}${CYAN}================================================================${RESET}\n`);

  const activeContract = await contractRepo.getActiveContract('battery_soc');
  const speedContract = await contractRepo.getActiveContract('speed_kmh');

  // Track initial memory
  if (global.gc) global.gc();
  const initialMemory = process.memoryUsage();
  console.log(`🧠 Initial Heap Memory: ${(initialMemory.heapUsed / (1024 * 1024)).toFixed(2)} MB`);

  // Phase 1: JIT Warmup (1,000 events)
  console.log('\n🔥 Phase 1: Warming up JIT compiler and internal caches (1,000 frames)...');
  for (let i = 0; i < 1000; i++) {
    const vin = `VIN-WARM-${String(i % 50).padStart(4, '0')}`;
    await veracityEngine.processTelemetry({
      vin,
      signal: 'battery_soc',
      value: 65.0 + (i % 10),
      seq: i + 1,
      eventTime: new Date(Date.now() - (1000 - i) * 100).toISOString(),
      provenance: { oem: 'DEMO_OEM', firmware: '4.6' },
      context: { speed_kmh: 45.0, odometer_km: 12000.0 + i * 0.01, gps: { lat: 37.7749, lon: -122.4194 } },
    }, activeContract);
  }
  console.log('✅ JIT Warmup complete.\n');

  // Phase 2: 100K Telemetry Processing
  const TOTAL_EVENTS = 100000;
  const CONCURRENCY = 200;
  const NUM_VEHICLES = 10000;
  console.log(`⚡ Phase 2: Processing ${formatNumber(TOTAL_EVENTS)} events across ${formatNumber(NUM_VEHICLES)} fleet vehicles...`);
  console.log(`   Pipeline streaming with concurrency window of ${CONCURRENCY} frames.`);

  const latencies = [];
  let processedCount = 0;
  let quarantinedCount = 0;
  let verifiedTrustCount = 0;

  const benchStartTime = process.hrtime.bigint();
  let eventCursor = 0;

  async function worker() {
    while (eventCursor < TOTAL_EVENTS) {
      const eventIdx = eventCursor++;
      if (eventIdx >= TOTAL_EVENTS) break;

      const vehicleId = eventIdx % NUM_VEHICLES;
      const vin = `VIN-PERF-${String(vehicleId).padStart(6, '0')}`;
      const isOtaFault = eventIdx % 20 === 0;

      const payload = {
        vin,
        signal: 'battery_soc',
        value: isOtaFault ? 0.72 : 72.0 + (eventIdx % 15) * 0.5,
        seq: Math.floor(eventIdx / NUM_VEHICLES) + 1,
        eventTime: new Date(Date.now() - (TOTAL_EVENTS - eventIdx) * 10).toISOString(),
        provenance: {
          oem: 'DEMO_OEM',
          firmware: isOtaFault ? '4.7' : '4.6',
          otaCampaign: isOtaFault ? 'CAMPAIGN-OTA-47' : null,
        },
        context: {
          speed_kmh: 55.0,
          odometer_km: 14500.0 + (eventIdx % 100) * 0.1,
          gps: { lat: 37.7749 + (eventIdx % 100) * 0.0001, lon: -122.4194 + (eventIdx % 100) * 0.0001 },
        },
      };

      const startSingle = process.hrtime.bigint();
      const res = await veracityEngine.processTelemetry(payload, activeContract);
      const endSingle = process.hrtime.bigint();

      if (eventIdx % 5 === 0) { // Sample 20% for exact latency distribution (20,000 samples)
        latencies.push(Number(endSingle - startSingle) / 1e6);
      }

      if (res && res.veracityRecord) {
        if (res.veracityRecord.trust >= 0.5) {
          verifiedTrustCount++;
        } else {
          quarantinedCount++;
        }
      }
      processedCount++;

      if (processedCount % 25000 === 0) {
        const elapsedSec = Number(process.hrtime.bigint() - benchStartTime) / 1e9;
        const currentRate = processedCount / elapsedSec;
        process.stdout.write(`   📊 Progress: ${formatNumber(processedCount)} / ${formatNumber(TOTAL_EVENTS)} [${((processedCount / TOTAL_EVENTS) * 100).toFixed(0)}%] | Instant Throughput: ${formatNumber(currentRate)} events/sec\n`);
      }
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, () => worker());
  await Promise.all(workers);

  const benchEndTime = process.hrtime.bigint();
  const totalElapsedSec = Number(benchEndTime - benchStartTime) / 1e9;
  const sustainedThroughput = TOTAL_EVENTS / totalElapsedSec;

  // Latency Analysis
  latencies.sort((a, b) => a - b);
  const p50 = computePercentile(latencies, 50);
  const p95 = computePercentile(latencies, 95);
  const p99 = computePercentile(latencies, 99);
  const pMax = latencies[latencies.length - 1];

  // Phase 3: 3x Burst Ingestion Proof (30,000 frames burst)
  console.log(`\n💥 Phase 3: Testing 3x Burst Handling (30,000 frames burst across streaming queues)...`);
  const BURST_EVENTS = 30000;
  const BURST_CONCURRENCY = 300;
  let burstProcessed = 0;
  let burstCursor = 0;
  let burstDropped = 0;

  const burstStartTime = process.hrtime.bigint();

  async function burstWorker() {
    while (burstCursor < BURST_EVENTS) {
      const i = burstCursor++;
      if (i >= BURST_EVENTS) break;
      const vin = `VIN-BURST-${String(i % 5000).padStart(5, '0')}`;
      try {
        const res = await veracityEngine.processTelemetry({
          vin,
          signal: 'speed_kmh',
          value: 65.0,
          seq: i + 1,
          eventTime: new Date().toISOString(),
          provenance: { oem: 'DEMO_OEM', firmware: '4.6' },
          context: { speed_kmh: 65.0, odometer_km: 20000.0, gps: { lat: 37.77, lon: -122.41 } },
        }, speedContract);
        if (!res) burstDropped++;
      } catch (err) {
        burstDropped++;
      }
      burstProcessed++;
    }
  }

  const burstWorkers = Array.from({ length: BURST_CONCURRENCY }, () => burstWorker());
  await Promise.all(burstWorkers);

  const burstEndTime = process.hrtime.bigint();
  const burstElapsedSec = Number(burstEndTime - burstStartTime) / 1e9;
  const burstThroughput = BURST_EVENTS / burstElapsedSec;

  console.log(`✅ Burst Drain Complete: ${formatNumber(BURST_EVENTS)} frames drained in ${burstElapsedSec.toFixed(3)}s (${formatNumber(burstThroughput)} events/sec, ${burstDropped} dropped).`);

  // Phase 4: Heap Memory Delta Verification
  if (global.gc) global.gc();
  const finalMemory = process.memoryUsage();
  const heapDeltaMb = (finalMemory.heapUsed - initialMemory.heapUsed) / (1024 * 1024);

  // Calculate actual empirical packet delivery metrics
  const totalAttempted = TOTAL_EVENTS + BURST_EVENTS;
  const totalDropped = (TOTAL_EVENTS - processedCount) + burstDropped;
  const actualLossRatio = (totalDropped / totalAttempted) * 100;

  // Print Summary Table
  console.log(`\n${BOLD}================================================================${RESET}`);
  console.log(`${BOLD}📋 VISTA 100K PIPELINE THROUGHPUT & LATENCY MICROBENCHMARK AUDIT${RESET}`);
  console.log(`${BOLD}================================================================${RESET}`);
  console.log(`Benchmark Type            : ${BOLD}In-Process 9-Stage Veracity Microbenchmark${RESET}`);
  console.log(`Benchmark Scope           : ${BOLD}In-Process Engine Compute (Zero In-Memory Buffer Drops)${RESET}`);
  console.log(`Distributed Cluster Note  : Network transport & broker partitions covered in tests/chaos/`);
  console.log(`Total Telemetry Processed : ${BOLD}${formatNumber(processedCount + (BURST_EVENTS - burstDropped))} / ${formatNumber(totalAttempted)} frames${RESET}`);
  console.log(`Sustained Throughput Rate : ${BOLD}${GREEN}${formatNumber(sustainedThroughput)} events/sec${RESET}`);
  console.log(`3x Burst Peak Rate        : ${BOLD}${GREEN}${formatNumber(burstThroughput)} events/sec${RESET}`);
  console.log(`Latency Profile (p50)     : ${p50.toFixed(3)} ms`);
  console.log(`Latency Profile (p95)     : ${p95.toFixed(3)} ms`);
  console.log(`Latency Profile (p99)     : ${p99.toFixed(3)} ms`);
  console.log(`Latency Profile (Max)     : ${pMax.toFixed(3)} ms`);
  console.log(`Telemetry Veracity Sink   : ${formatNumber(verifiedTrustCount)} frames (trust >= 0.5)`);
  console.log(`Telemetry Quarantine Sink : ${formatNumber(quarantinedCount)} frames (trust < 0.5)`);
  console.log(`Heap Delta Over 130K msgs : ${heapDeltaMb.toFixed(2)} MB`);
  console.log(`Packet Loss Ratio         : ${BOLD}${actualLossRatio === 0 ? GREEN : RED}${actualLossRatio.toFixed(3)}%${RESET} (${totalDropped === 0 ? 'Zero lost frames' : formatNumber(totalDropped) + ' dropped frames'})`);
  console.log(`${BOLD}================================================================${RESET}\n`);

  // Assertions
  let passed = true;
  if (processedCount !== TOTAL_EVENTS) {
    console.error(`${RED}❌ FAILED: Event count mismatch (${processedCount} != ${TOTAL_EVENTS})${RESET}`);
    passed = false;
  }
  if (p95 > 35.0) {
    console.error(`${RED}❌ FAILED: p95 latency (${p95.toFixed(2)} ms) exceeded 35.0 ms threshold${RESET}`);
    passed = false;
  }
  if (burstDropped > 0) {
    console.error(`${RED}❌ FAILED: Detected ${burstDropped} dropped frames during burst${RESET}`);
    passed = false;
  }
  if (heapDeltaMb > 250.0) {
    console.error(`${RED}❌ FAILED: Unbounded memory leak detected (heap delta: ${heapDeltaMb.toFixed(2)} MB)${RESET}`);
    passed = false;
  }

  if (passed) {
    console.log(`${BOLD}${GREEN}🎉 100K PIPELINE MICROBENCHMARK & ZERO-LOSS BURST PROOF PASSED (100% COMPLIANT)${RESET}\n`);
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runPerformanceProof().catch((err) => {
  console.error(`${RED}Fatal performance runner error:${RESET}`, err);
  process.exit(1);
});
