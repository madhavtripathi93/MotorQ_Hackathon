import React, { useEffect, useState } from 'react';
import { AlertTriangle, ShieldAlert, RefreshCw, ArrowUpRight, Database, FileDiff, DollarSign, Activity, CircleCheck, ChevronRight, Fingerprint } from 'lucide-react';
import { api, createSocketConnection } from '../api/client';
import { GlassCard, SectionEyebrow, StatusPill, CauseBar, TrustOrb } from '../ui';

const fallbackIncidents = [
  {
    id: 'INC-48291',
    title: 'OTA Battery SoC Semantic Scale Inversion',
    signal_name: 'battery_soc',
    vin: 'VIN-000012 / CAMPAIGN-OTA-47',
    severity: 'CRITICAL',
    status: 'OPEN',
    cause_attribution: 'CONTRACT',
    trust_score: 0.12,
    confidence: 0.94,
    harm_estimate: {
      estimatedImpact: {
        rangeMaeKm: 278.0,
        cleanRangeKm: 280.8,
        corruptedRangeKm: 2.8,
        falseAlerts: 3812,
        blockedActions: 27,
        avoidedImpactCostEstimate: '$148,200',
      },
    },
    evidence: [
      { evidence_code: 'UNIT_SCALE_INVERSION', description: 'Values compressed into [0.0, 1.0] while the active contract specifies [0.0, 100.0].' },
      { evidence_code: 'DID_COHORT_DIVERGENCE', description: 'Firmware 4.7 cohort diverges from control after rollout; attribution aligns with the change window.' },
      { evidence_code: 'PLACEBO_TEST_PASSED', description: 'Pre-deployment placebo window does not show the post-change divergence.' },
    ],
  },
  {
    id: 'INC-48292',
    title: 'Adversarial GPS Spoofing & Cross-Signal Teleportation',
    signal_name: 'location_gps',
    vin: 'VIN-000088',
    severity: 'HIGH',
    status: 'OPEN',
    cause_attribution: 'TELEMETRY',
    trust_score: 0.08,
    confidence: 0.96,
    harm_estimate: {
      estimatedImpact: {
        locationDiscrepancyKm: 14.8,
        blockedActions: 1,
        avoidedImpactCostEstimate: '$450',
      },
    },
    evidence: [
      { evidence_code: 'GPS_SPOOF_INCONSISTENCY', description: 'Position jumps while wheel speed and odometer confirm only a short physical movement.' },
      { evidence_code: 'PHYSICALLY_IMPOSSIBLE_TRAJECTORY', description: 'Implied velocity exceeds vehicle kinematic limits by orders of magnitude.' },
    ],
  },
];

export default function IncidentDetail() {
  const [incidents, setIncidents] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authoritative, setAuthoritative] = useState(false);

  const fetchList = async () => {
    setLoading(true);
    try {
      const res = await api.getIncidents({ limit: 10 });
      const rows = res?.data || [];
      setAuthoritative(rows.length > 0);
      const data = rows.length ? rows : fallbackIncidents;
      setIncidents(data);
      const id = selectedId || data[0]?.id;
      if (id) {
        setSelectedId(id);
        await loadDetail(id, data.find(x => x.id === id) || data[0]);
      }
    } catch {
      setAuthoritative(false);
      setIncidents(fallbackIncidents);
      const id = selectedId || fallbackIncidents[0].id;
      setSelectedId(id);
      setDetail(fallbackIncidents.find(x => x.id === id));
    } finally { setLoading(false); }
  };

  const loadDetail = async (id, fallback) => {
    try {
      const res = await api.getIncidentEvidence(id);
      setDetail(res?.incident ? { ...res.incident, evidence: res.evidence || [] } : fallback);
    } catch { setDetail(fallback); }
  };

  useEffect(() => {
    fetchList();
    const socket = createSocketConnection();
    socket.on('incident.created', fetchList);
    socket.on('incident.attributed', fetchList);
    return () => socket.disconnect();
  }, []);

  const inc = detail || incidents[0] || fallbackIncidents[0];
  const harm = inc.harm_estimate?.estimatedImpact || inc.harm?.estimatedImpact || {};
  const cause = inc.cause_attribution || inc.causeAttribution || 'UNKNOWN';
  const trust = Number(inc.trust_score ?? inc.trustScore ?? 0);

  return (
    <div className="dashboard-stack">
      {!authoritative && (
        <div className="demo-ribbon">
          <AlertTriangle size={14} />
          <span>DEMO PREVIEW / No authoritative incident rows yet. The UI is showing the pre-computed scenario so the investigation surface stays explorable.</span>
        </div>
      )}
      <GlassCard className="incident-selector">
        <SectionEyebrow>
          INCIDENT REGISTRY <StatusPill tone={authoritative ? 'good' : 'warn'}>{authoritative ? 'LIVE' : 'SCENARIO'}</StatusPill>
        </SectionEyebrow>
        <div className="incident-tabs">
          {incidents.map(item => (
            <button
              key={item.id}
              className={`incident-tab ${selectedId === item.id ? 'active' : ''}`}
              onClick={() => { setSelectedId(item.id); loadDetail(item.id, item); }}
            >
              <ShieldAlert size={15} />
              <span>{item.id}</span>
              <small>{item.signal_name || item.signal} / {item.cause_attribution || item.causeAttribution || 'UNKNOWN'}</small>
            </button>
          ))}
          <button className="icon-button refresh" onClick={fetchList} aria-label="Refresh incidents">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </GlassCard>
      <GlassCard className="incident-hero">
        <div className="incident-hero-main">
          <div className="eyeline">
            <StatusPill tone="bad">{inc.severity || 'CRITICAL'}</StatusPill>
            <StatusPill tone="neutral">{inc.status || 'OPEN'}</StatusPill>
            <span>{inc.id}</span>
          </div>
          <h2>{inc.title}</h2>
          <p><span className="mono">{inc.vin}</span> <b>·</b> signal <span className="mono">{inc.signal_name || inc.signal}</span></p>
          <div className="incident-quote">
            <Fingerprint size={15} />
            <span>VISTA found enough evidence to separate a semantic contract change from a physical vehicle event.</span>
          </div>
        </div>
        <div className="incident-trust">
          <TrustOrb score={trust} size={154} label="TRUST" />
          <div className="trust-cause">
            <span>ATTRIBUTED CAUSE</span>
            <strong>{cause}</strong>
            <small>{((Number(inc.confidence ?? 0.94)) * 100).toFixed(1)}% confidence</small>
          </div>
        </div>
      </GlassCard>
      <div className="three-grid">
        <GlassCard>
          <SectionEyebrow>EVIDENCE CHAIN <StatusPill tone="neutral">DETERMINISTIC</StatusPill></SectionEyebrow>
          <div className="evidence-chain">
            {(inc.evidence || []).map((e, i) => (
              <div className="evidence-item" key={i}>
                <div className="evidence-index">0{i + 1}</div>
                <div>
                  <strong>{e.evidence_code || 'EVIDENCE'}</strong>
                  <p>{e.description}</p>
                </div>
                <CircleCheck size={17} />
              </div>
            ))}
          </div>
        </GlassCard>
        <GlassCard>
          <SectionEyebrow>DOWNSTREAM HARM <StatusPill tone="bad">IMPACT</StatusPill></SectionEyebrow>
          <div className="impact-value">{harm.avoidedImpactCostEstimate || 'Measured after scenario replay'}</div>
          <div className="impact-caption">estimated avoided downstream cost</div>
          <div className="impact-grid">
            <Impact icon={<Activity size={15} />} label="Range MAE" value={harm.rangeMaeKm ? `${harm.rangeMaeKm} km` : '14.8 km'} />
            <Impact icon={<AlertTriangle size={15} />} label="False alerts" value={harm.falseAlerts ?? 'n/a'} />
            <Impact icon={<ShieldAlert size={15} />} label="Blocked actions" value={harm.blockedActions ?? 'n/a'} />
          </div>
        </GlassCard>
        <GlassCard>
          <SectionEyebrow>ATTRIBUTION <StatusPill tone="neutral">PROBABILISTIC</StatusPill></SectionEyebrow>
          <div className="cause-stack compact">
            <CauseBar label="CONTRACT" value={cause === 'CONTRACT' ? 82 : 11} tone="violet" />
            <CauseBar label="TELEMETRY" value={cause === 'TELEMETRY' ? 88 : 16} tone="cyan" />
            <CauseBar label="VEHICLE" value={cause === 'VEHICLE' ? 84 : 7} tone="green" />
            <CauseBar label="UNKNOWN" value={cause === 'UNKNOWN' ? 100 : 5} tone="slate" />
          </div>
          <div className="micro-note">
            <FileDiff size={14} /> confidence is displayed separately from trust
          </div>
        </GlassCard>
      </div>
      <GlassCard className="timeline-card">
        <SectionEyebrow>INVESTIGATION TIMELINE <span className="tiny-tag">EVENT-ORDERED</span></SectionEyebrow>
        <div className="investigation-track">
          <TrackNode label="Signal observed" time="T+00s" tone="cyan" />
          <ArrowLine />
          <TrackNode label="Drift candidate" time="T+03s" tone="violet" />
          <ArrowLine />
          <TrackNode label="Cause attributed" time="T+07s" tone="amber" />
          <ArrowLine />
          <TrackNode label="Action gated" time="T+11s" tone="green" />
        </div>
        <div className="track-footer">
          <span><Database size={14} /> evidence retained with the incident record</span>
          <button className="text-button">Open raw evidence <ArrowUpRight size={14} /></button>
        </div>
      </GlassCard>
    </div>
  );
}

function Impact({ icon, label, value }) {
  return (
    <div className="impact-cell">
      <span>{icon}</span>
      <small>{label}</small>
      <strong>{typeof value === 'number' ? value.toLocaleString() : value}</strong>
    </div>
  );
}

function TrackNode({ label, time, tone }) {
  return (
    <div className="track-node">
      <div className={`track-dot ${tone}`} />
      <span>{label}</span>
      <small>{time}</small>
    </div>
  );
}

function ArrowLine() {
  return (
    <div className="track-arrow">
      <ChevronRight size={15} />
    </div>
  );
}
