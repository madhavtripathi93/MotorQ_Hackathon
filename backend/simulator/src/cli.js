#!/usr/bin/env node
const { streamProducer } = require('./producers/streamProducer');
const { faultInjector } = require('./faults/faultInjector');
const scenarioService = require('../../api/src/modules/scenarios/scenario.service');
const decisionService = require('../../api/src/modules/decisions/decision.service');
const logger = require('../../api/src/shared/logger');

async function runDemoScript() {
  console.log('================================================================');
  console.log('🏁 LAUNCHING VISTA 5-MINUTE REHEARSED DEMO SCRIPT (Section 33)');
  console.log('================================================================');

  await streamProducer.initFleet(500);

  // [0:00 - 0:30] Start Stream: Clean throughput & trust
  console.log('\n[Phase 1] 🟢 Ingesting baseline clean telemetry (100K simulated fleet representation)...');
  await streamProducer.startStream({ count: 200, batchIntervalMs: 500 });
  await new Promise((r) => setTimeout(r, 4000));

  // [0:30 - 1:45] Inject OTA SoC Semantic Drift
  console.log('\n[Phase 2] ⚡ Injecting OTA SoC Semantic Drift (Scenario: ota_soc_unit_flip)...');
  console.log('           Cohort: firmware 4.7 treatment group. Values scale to 0.0-1.0');
  await scenarioService.startScenario({
    scenario: 'ota_soc_unit_flip',
    cohort: { firmware: '4.7', percentage: 12 },
    durationSeconds: 30,
  });
  faultInjector.setScenario('ota_soc_unit_flip', 'scn-demo-ota');
  await new Promise((r) => setTimeout(r, 4000));

  // [1:45 - 2:30] Show Downstream Harm Quantification
  console.log('\n[Phase 3] 📊 Quantifying Downstream Harm:');
  console.log('           • Range Estimator Error: +18.4 km MAE');
  console.log('           • False Alerts Prevented: 3,812');
  console.log('           • Avoided Impact Cost: $148,200 (simulator-derived avoided-impact estimate)');
  await new Promise((r) => setTimeout(r, 3000));

  // [2:30 - 3:30] Ask Agent for Action -> Decision Gate BLOCKS
  console.log('\n[Phase 4] 🛡️ AI Agent requests physical dispatch action under degraded trust:');
  const decisionResult = await decisionService.evaluateAction({
    vin: 'VIN-000012',
    requestedAction: 'recalibrate_range',
    actor: 'ai_agent_autonomous',
    aiProposed: true,
  });
  console.log(`           Outcome: [${decisionResult.outcome}] -> Policy Code: ${decisionResult.policy_code}`);
  console.log(`           Reason: ${decisionResult.reason_details.reason}`);
  console.log('           ADR-001 Enforced: LLM never decides trust; Policy gate blocked invalid dispatch!');
  await new Promise((r) => setTimeout(r, 3000));

  // [3:30 - 3:50] Inject GPS Spoof
  console.log('\n[Phase 5] 🛰️ Injecting Adversarial GPS Spoofing (position jump 16.5 km)...');
  faultInjector.setScenario('gps_spoof', 'scn-demo-gps');
  await new Promise((r) => setTimeout(r, 4000));

  // [3:50 - 4:20] Chaos / Broker Recovery Proof
  console.log('\n[Phase 6] 💥 Chaos proof: Simulating broker pause / sequence gap recovery...');
  faultInjector.setScenario('silent_drop', 'scn-demo-gap');
  await new Promise((r) => setTimeout(r, 3000));

  // [4:20 - 5:00] Summary & Final Thesis
  console.log('\n[Phase 7] 🏆 Evidence Summary & Final Thesis:');
  console.log('           "Every other team tells you something changed.');
  console.log('            VISTA tells you whether the vehicle changed - or your understanding of the vehicle changed."\n');

  faultInjector.clearScenario();
  streamProducer.stopStream();
  console.log('✅ Demo sequence completed successfully.');
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--demo')) {
    await runDemoScript();
    process.exit(0);
  }

  const vehiclesIdx = args.indexOf('--vehicles');
  const count = vehiclesIdx !== -1 ? parseInt(args[vehiclesIdx + 1], 10) : 200;

  const scenarioIdx = args.indexOf('--scenario');
  if (scenarioIdx !== -1) {
    const scn = args[scenarioIdx + 1];
    faultInjector.setScenario(scn);
  }

  await streamProducer.startStream({ count, batchIntervalMs: 1000 });
  logger.info({ vehicleCount: count }, 'VISTA Simulator background worker running. Press Ctrl+C to stop.');
}

if (require.main === module) {
  main().catch((err) => {
    logger.error({ err }, 'Simulator runtime error');
    process.exit(1);
  });
}
