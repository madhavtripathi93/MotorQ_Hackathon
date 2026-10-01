import React from 'react';
import { Activity, ShieldCheck, AlertCircle, Database, ArrowUpRight, ArrowRight, Sparkles, Radio, LockKeyhole, Gauge, Orbit } from 'lucide-react';
import { GlassCard, MetricCard, StatusPill, SectionEyebrow, Sparkline, HolographicVehicle, CauseBar, MiniBars } from '../ui';

const fallback = {
  ingestCount: 142850,
  blockedCount: 27,
  p95: 4.2,
  trustGrade: 93.8,
};

const liveSpark = [38, 44, 42, 51, 48, 63, 60, 72, 65, 77, 74, 88, 81, 92, 95, 90, 96, 98];

const trustMix = [
  { label: 'Decision-grade', value: 93.8, tone: 'good', count: '93,800 VINs' },
  { label: 'Operator review', value: 4.1, tone: 'warn', count: '4,100 VINs' },
  { label: 'Quarantined', value: 2.1, tone: 'bad', count: '2,100 VINs' },
];

export default function FleetOverview({ metrics, liveEvents = [], onSelectIncident }) {
  const p95 = metrics?.veracityLatency?.p95 ?? fallback.p95;
  const ingest = metrics?.counters?.vista_ingest_events_total ?? fallback.ingestCount;
  const blocked = metrics?.counters?.vista_decision_blocked_total ?? fallback.blockedCount;

  return (
    <div className="dashboard-stack">
      <GlassCard className="hero-card">
        <div className="hero-copy">
          <div className="hero-badge"><span className="hero-badge-dot" /> VISTA CONTROL TOWER / LIVE</div>
          <h2>Know whether the <em>vehicle changed</em> - or your understanding changed.</h2>
          <p>A decision-grade telemetry layer that detects drift, attributes the cause, quantifies downstream harm and gates actions before bad signals become bad decisions.</p>
          <div className="hero-actions">
            <button className="btn btn-primary" onClick={onSelectIncident}>
              <AlertCircle size={16} /> Inspect active incidents <ArrowRight size={15} />
            </button>
            <span className="hero-note"><LockKeyhole size={13} /> AI can propose. Policy decides.</span>
          </div>
          <div className="hero-flow">
            <span>DETECT</span><i /><span>ATTRIBUTE</span><i /><span>QUANTIFY HARM</span><i /><span>GATE</span>
          </div>
        </div>
        <HolographicVehicle severity="nominal" />
      </GlassCard>
      <div className="metric-grid">
        <MetricCard label="Fleet model" value={100000} meta="1 Hz baseline / synthetic VINs" tone="cyan" icon={<Database size={16} />} foot={<><span className="pulse-indicator" /> 100% simulator coverage</>} />
        <MetricCard label="Ingest volume" value={ingest} meta={`p95 veracity ${p95} ms`} tone="violet" icon={<Activity size={16} />} foot={<MiniBars values={[21, 28, 24, 33, 40, 37, 48, 56, 51, 62]} tone="violet" />} />
        <MetricCard label="Trust-grade fleet" value={fallback.trustGrade} suffix="%" meta="Decision-grade threshold >= 0.85" tone="green" icon={<ShieldCheck size={16} />} foot={<span className="good-text">+2.3 pts vs prior window</span>} />
        <MetricCard label="Actions blocked" value={blocked} meta="Fail-closed policy gate" tone="amber" icon={<LockKeyhole size={16} />} foot={<span className="warn-text">2 active incidents</span>} />
      </div>
      <div className="overview-grid">
        <GlassCard className="wide-card">
          <SectionEyebrow>TRUST PULSE <StatusPill tone="good">REAL-TIME</StatusPill></SectionEyebrow>
          <div className="card-title-row">
            <div>
              <h3>Fleet signal health</h3>
              <p>Telemetry quality and trust movement over the current operating window.</p>
            </div>
            <div className="chart-stat">
              <strong>{p95.toFixed ? p95.toFixed(1) : p95}</strong>
              <span>ms p95</span>
            </div>
          </div>
          <div className="spark-wrap">
            <div className="grid-lines" />
            <Sparkline values={liveSpark} tone="cyan" height={160} />
            <div className="chart-marker marker-one"><span /> OTA drift cohort</div>
            <div className="chart-marker marker-two"><span /> current</div>
          </div>
          <div className="chart-footer">
            <span><i className="legend-dot cyan" /> Veracity processing</span>
            <span><i className="legend-dot violet" /> Attribution windows</span>
            <span><i className="legend-dot green" /> Decision-grade</span>
          </div>
        </GlassCard>
        <GlassCard className="side-card">
          <SectionEyebrow>TRUST DISTRIBUTION <StatusPill tone="neutral">CALIBRATED</StatusPill></SectionEyebrow>
          <div className="trust-mix">
            {trustMix.map(row => (
              <div className="mix-row" key={row.label}>
                <div className="mix-head"><span>{row.label}</span><strong>{row.value}%</strong></div>
                <div className="mix-track"><span className={`mix-fill ${row.tone}`} style={{ width: `${row.value}%` }} /></div>
                <small>{row.count}</small>
              </div>
            ))}
          </div>
          <div className="distribution-foot">
            <Orbit size={16} />
            <span>UNKNOWN remains a first-class outcome when evidence is insufficient.</span>
          </div>
        </GlassCard>
      </div>
      <div className="overview-grid bottom-grid">
        <GlassCard>
          <SectionEyebrow>CAUSAL ATTRIBUTION <span className="tiny-tag">CURRENT WINDOW</span></SectionEyebrow>
          <div className="card-title-row">
            <div>
              <h3>What changed?</h3>
              <p>Cause probabilities from deterministic evidence + cohort statistics.</p>
            </div>
            <Sparkline values={[12, 15, 14, 16, 21, 22, 32, 29, 42, 48, 46]} tone="violet" height={54} />
          </div>
          <div className="cause-stack">
            <CauseBar label="CONTRACT" value={61} tone="violet" />
            <CauseBar label="TELEMETRY" value={21} tone="cyan" />
            <CauseBar label="VEHICLE" value={12} tone="green" />
            <CauseBar label="UNKNOWN" value={6} tone="slate" />
          </div>
          <div className="attribute-foot">
            <span><Gauge size={14} /> calibration temperature 1.85</span>
            <span>softmax + held-out checks</span>
          </div>
        </GlassCard>
        <GlassCard className="incident-feed">
          <SectionEyebrow>LIVE INCIDENTS <StatusPill tone="bad">2 OPEN</StatusPill></SectionEyebrow>
          <div className="incident-list">
            <IncidentRow tone="bad" title="OTA SoC semantic scale inversion" subtitle="VIN-000012 / firmware 4.7 cohort" metric="Trust 0.12" action={onSelectIncident} />
            <IncidentRow tone="warn" title="Adversarial GPS spoofing" subtitle="VIN-000088 / cross-signal mismatch" metric="Trust 0.08" action={onSelectIncident} />
            {liveEvents.slice(0, 2).map((e, i) => (
              <IncidentRow key={i} tone={e.trust < 0.5 ? 'bad' : 'good'} title={`Live event / ${e.vin || 'vehicle'}`} subtitle={e.signal || 'telemetry'} metric={`Trust ${Number(e.trust || 0).toFixed(2)}`} action={onSelectIncident} />
            ))}
          </div>
          <button className="text-button" onClick={onSelectIncident}>
            Open incident registry <ArrowUpRight size={14} />
          </button>
        </GlassCard>
      </div>
      <div className="system-strip">
        <div>
          <Radio size={15} /><strong>VERACITY FABRIC</strong>
          <span>Kafka -&gt; streaming worker -&gt; Redis / ClickHouse -&gt; policy gate</span>
        </div>
        <div className="system-strip-right">
          <span><span className="pulse-indicator" /> stream healthy</span>
          <span>event-time / at-least-once</span>
        </div>
      </div>
    </div>
  );
}

function IncidentRow({ tone, title, subtitle, metric, action }) {
  return (
    <button className="incident-row" onClick={action}>
      <span className={`incident-severity sev-${tone}`} />
      <span className="incident-copy">
        <strong>{title}</strong>
        <small>{subtitle}</small>
      </span>
      <span className="incident-metric">{metric}</span>
      <ArrowUpRight size={14} />
    </button>
  );
}
