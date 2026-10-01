# VISTA 5-Minute Rehearsed Demo Walkthrough Script

| Time | Phase / Action | What Judge Sees on Dashboard | Technical Verification |
|---|---|---|---|
| **0:00 - 0:30** | **Start 100K Stream** | Fleet Overview: 100K vehicles active, p95 latency ~4ms, trust distribution 93.8% decision-grade. | High-throughput telemetry ingestion, low latency, clean baseline. |
| **0:30 - 1:45** | **Inject OTA SoC Semantic Drift** | Incident Alert triggered: `INC-48291`. Trust drops to 0.12 for firmware 4.7 cohort. Contract diff shows 0-100% vs 0.0-1.0 compression. | Root cause attributed to `CONTRACT` (not hardware sensor failure). DiD confirms -71.4% cohort drop. |
| **1:45 - 2:30** | **Show Downstream Harm** | Quantified Downstream Harm card: +18.4 km range error MAE, 3,812 false panic alarms prevented, **$148,200 avoided impact estimate**. | Formula displayed: `(27 Dispatches × $450) + (3,812 Alerts × $35)`. Explicit simulator-derived labeling. |
| **2:30 - 3:30** | **Ask AI Agent for Action** | Decision Panel: AI Agent requests battery service dispatch. **Deterministic Policy Gate BLOCKS action** with `INSUFFICIENT_SIGNAL_TRUST`. | **ADR-001 Enforced**: LLM never decides trust; Policy gate protects physical vehicle. Cryptographic audit record created. |
| **3:30 - 3:50** | **Inject GPS Spoofing** | Incident `INC-48292` appears: position jumps 14.8 km into Lake Michigan while wheel speed and odometer show vehicle is stationary. | Cross-signal invariant flags `GPS_SPOOF_INCONSISTENCY`; location trust drops to 0.08. Recovery towing blocked. |
| **3:50 - 4:20** | **Chaos Broker Recovery** | Pre-staged broker kill: graceful pause, internal buffering, automatic sequence reconciliation with 0 message loss. | Sequence numbers and deduplication verified; consumer lag recovers cleanly. |
| **4:20 - 5:00** | **Evidence Summary & Thesis** | Scorecard displays all 6 Acceptance Gates passed; immutable audit logs verified. | **Closing line**: *"Every other team tells you something changed. VISTA tells you whether the vehicle changed - or your understanding of the vehicle changed."* |
