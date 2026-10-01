import React, { useState } from 'react';
import { Bot, Scale, ShieldCheck, ShieldAlert, UserRound, LockKeyhole, ArrowRight, CheckCircle2, XCircle, Sparkles, Fingerprint, Info } from 'lucide-react';
import { api } from '../api/client';
import { GlassCard, SectionEyebrow, StatusPill, TrustOrb, CauseBar, SentinelAvatar } from '../ui';

const presets = {
  'VIN-000088': { title: 'GPS spoofed', signal: 'location_gps', trust: 0.08, status: 'QUARANTINED', evidence: ['GPS_SPOOF_INCONSISTENCY', 'ODOMETER_DELTA_MATCH', 'PHYSICALLY_IMPOSSIBLE_TRAJECTORY'] },
  'VIN-000012': { title: 'OTA unit flip', signal: 'battery_soc', trust: 0.12, status: 'QUARANTINED', evidence: ['CONTRACT_SEMANTIC_DRIFT', 'UNIT_SCALE_INVERSION', 'DID_COHORT_DIVERGENCE'] },
  'VIN-004281': { title: 'clean baseline', signal: 'speed_kmh', trust: 0.94, status: 'DECISION-GRADE', evidence: ['FRESH', 'IN_RANGE', 'GPS_SPEED_MATCH', 'ODOMETER_DELTA_MATCH'] },
};

export default function DecisionPanel() {
  const [vin, setVin] = useState('VIN-000088');
  const [action, setAction] = useState('dispatch_recovery');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiReport, setAiReport] = useState(null);
  const current = presets[vin];

  const evaluate = async (proposedBy = 'operator') => {
    setError(null);
    try {
      setResult(await api.evaluateDecision({ vin, requestedAction: action, proposedBy }));
    } catch (e) {
      setResult(null);
      setError(e.data?.message || e.message || 'Decision gate unavailable');
    }
  };

  const askAi = async () => {
    setAiLoading(true);
    setError(null);
    await new Promise(r => setTimeout(r, 900));
    const report = vin === 'VIN-000088' ? {
      proposal: 'Delay towing; request fresh GNSS evidence.',
      investigation: 'Position jumps while wheel/odometer movement remains near-zero. This is consistent with a telemetry integrity fault.',
      constraint: 'AI cannot override the deterministic policy gate.'
    } : vin === 'VIN-000012' ? {
      proposal: 'Remap battery_soc using the new semantic contract.',
      investigation: 'Firmware 4.7 introduces a unit-interval fraction while the active contract expects percentage points.',
      constraint: 'Physical isolation remains prohibited without decision-grade evidence.'
    } : {
      proposal: 'Allow action.',
      investigation: 'Freshness, bounds and cross-signal coherence are within policy thresholds.',
      constraint: 'Normal policy path.'
    };
    setAiReport(report);
    setAiLoading(false);
    await evaluate('ai_agent');
  };

  return (
    <div className="dashboard-stack">
      <GlassCard className="decision-hero">
        <div>
          <div className="hero-badge"><span className="hero-badge-dot violet" /> SAFETY GATE / HUMAN OVERSIGHT</div>
          <h2>AI can investigate. <em>VISTA still decides.</em></h2>
          <p>Evidence establishes trust. Policy turns trust into an allowed or blocked action. The agent remains inside those boundaries.</p>
          <div className="principle-line">
            <span><Fingerprint size={15} /> evidence</span>
            <i />
            <span><Scale size={15} /> policy</span>
            <i />
            <span><Bot size={15} /> proposal</span>
            <i />
            <span><UserRound size={15} /> human</span>
          </div>
        </div>
        <SentinelAvatar mood={current.trust < 0.5 ? 'alert' : 'calm'} />
      </GlassCard>
      <GlassCard>
        <SectionEyebrow>ACTION REQUEST <StatusPill tone="neutral">GATE TESTER</StatusPill></SectionEyebrow>
        <div className="decision-controls">
          <label>Vehicle
            <select value={vin} onChange={e => { setVin(e.target.value); setResult(null); setAiReport(null); }}>
              <option value="VIN-000088">VIN-000088 / GPS spoof</option>
              <option value="VIN-000012">VIN-000012 / OTA unit flip</option>
              <option value="VIN-004281">VIN-004281 / clean baseline</option>
            </select>
          </label>
          <label>Action
            <select value={action} onChange={e => { setAction(e.target.value); setResult(null); }}>
              <option value="dispatch_recovery">dispatch_recovery</option>
              <option value="recalibrate_range">recalibrate_range</option>
              <option value="high_voltage_isolation">high_voltage_isolation</option>
              <option value="driver_penalty_point">driver_penalty_point</option>
            </select>
          </label>
          <div className="decision-buttons">
            <button className="btn btn-primary" onClick={() => evaluate('operator')}>
              <Scale size={15} /> Evaluate gate
            </button>
            <button className="btn btn-secondary ai-btn" onClick={askAi} disabled={aiLoading}>
              <Bot size={15} /> {aiLoading ? 'Investigating...' : 'Ask AI agent'}
            </button>
          </div>
        </div>
      </GlassCard>
      <div className="decision-grid">
        <GlassCard className="evidence-panel">
          <SectionEyebrow>01 / VISTA EVIDENCE <StatusPill tone="good">AUTHORITATIVE</StatusPill></SectionEyebrow>
          <div className="evidence-header">
            <div>
              <div className="vehicle-id">{vin}</div>
              <strong>{current.title}</strong>
            </div>
            <TrustOrb score={current.trust} size={138} />
          </div>
          <div className="evidence-chips">
            {current.evidence.map(e => <span key={e}><CheckCircle2 size={12} /> {e}</span>)}
          </div>
        </GlassCard>
        <GlassCard className="policy-panel">
          <SectionEyebrow>02 / POLICY GATE <StatusPill tone="warn">DETERMINISTIC</StatusPill></SectionEyebrow>
          <div className="policy-threshold">
            <span>Required trust</span>
            <strong>{action === 'dispatch_recovery' ? '0.85' : action === 'recalibrate_range' ? '0.80' : action === 'high_voltage_isolation' ? '0.95' : '0.90'}</strong>
          </div>
          <div className="policy-bar">
            <span style={{ width: `${current.trust * 100}%` }} />
          </div>
          <div className={`gate-result ${error ? 'bad' : result?.outcome === 'ALLOW' ? 'good' : 'bad'}`}>
            {error ? <XCircle size={17} /> : result?.outcome === 'ALLOW' ? <CheckCircle2 size={17} /> : <ShieldAlert size={17} />}
            <strong>{error ? 'FAIL-CLOSED' : result ? result.outcome : 'AWAITING EVALUATION'}</strong>
          </div>
          <small className="policy-note">
            <LockKeyhole size={12} /> thresholds stay outside the AI agent
          </small>
        </GlassCard>
        <GlassCard className="ai-panel">
          <SectionEyebrow>03 / AI INVESTIGATOR <StatusPill tone="violet">PROPOSAL ONLY</StatusPill></SectionEyebrow>
          <div className="ai-head">
            <SentinelAvatar mood="calm" />
            <div>
              <strong>VISTA Sentinel</strong>
              <span>evidence navigator</span>
            </div>
          </div>
          {aiReport ? (
            <div className="ai-report">
              <div><small>PROPOSAL</small><p>{aiReport.proposal}</p></div>
              <div><small>INVESTIGATION</small><p>{aiReport.investigation}</p></div>
              <div className="ai-guard"><Info size={14} /> {aiReport.constraint}</div>
            </div>
          ) : (
            <div className="ai-empty">
              Ask the agent to interpret the evidence and propose a safe next step. The gate still evaluates the request independently.
            </div>
          )}
        </GlassCard>
      </div>
      <GlassCard>
        <SectionEyebrow>04 / CAUSAL EVIDENCE MIX <span className="tiny-tag">EXPLAINABILITY</span></SectionEyebrow>
        <div className="cause-matrix">
          <CauseBar label="CONTRACT" value={vin === 'VIN-000012' ? 82 : 9} tone="violet" />
          <CauseBar label="TELEMETRY" value={vin === 'VIN-000088' ? 88 : 14} tone="cyan" />
          <CauseBar label="VEHICLE" value={vin === 'VIN-004281' ? 71 : 6} tone="green" />
          <CauseBar label="UNKNOWN" value={4} tone="slate" />
        </div>
        <div className="final-action">
          <span>FINAL EXECUTION</span>
          <strong>{error ? 'BLOCKED / DEPENDENCY UNAVAILABLE' : result?.outcome === 'ALLOW' ? 'ACTION ALLOWED' : 'ACTION NOT AUTHORIZED'}</strong>
          <ArrowRight size={15} />
        </div>
      </GlassCard>
    </div>
  );
}
