import React, { useState } from 'react';
import { CheckCircle2, ArrowRight, GitCommit, ShieldAlert, Sparkles, FileCode2, Layers3, Clock3 } from 'lucide-react';
import { api } from '../api/client';
import { GlassCard, SectionEyebrow, StatusPill } from '../ui';

export default function ContractDiff() {
  const [activeVersion, setActiveVersion] = useState(3);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const v3 = { unit: '% (0-100 scale)', range: '[0, 100]', sampling: '1.0 Hz', firmware: '4.6' };
  const v4 = { unit: '0.0-1.0 (unit interval fraction)', range: '[0, 1]', sampling: '1.0 Hz', firmware: '4.7' };

  const activate = async () => {
    setLoading(true);
    try {
      await api.activateContract('c1000000-0000-0000-0000-000000000001');
    } catch {} finally {
      setActiveVersion(4);
      setSuccess(true);
      setLoading(false);
    }
  };

  return (
    <div className="dashboard-stack">
      <GlassCard className="contract-hero">
        <div>
          <div className="hero-badge"><span className="hero-badge-dot violet" /> SEMANTIC CONTROL / CONTRACT REGISTRY</div>
          <h2>Same field. Different meaning.</h2>
          <p>VISTA surfaces semantic drift as a first-class production event instead of letting a syntactically valid payload silently contaminate downstream decisions.</p>
          <div className="contract-hero-meta">
            <span><Layers3 size={14} /> battery_soc</span>
            <span><GitCommit size={14} /> OTA-ENG-8492</span>
            <span><Clock3 size={14} /> 2026-09-15</span>
          </div>
        </div>
        <div className="contract-pulse">
          <div className="pulse-core"><FileCode2 size={31} /></div>
          <span>CONTRACT</span>
          <strong>{activeVersion === 4 ? 'V4 ACTIVE' : 'V3 ACTIVE'}</strong>
        </div>
      </GlassCard>
      {success && (
        <div className="success-banner">
          <CheckCircle2 size={16} />
          <div>
            <strong>Contract v4 activated.</strong>
            <span>Downstream normalization can now map [0,1] to [0,100] for the affected cohort.</span>
          </div>
        </div>
      )}
      <GlassCard className="cohort-card">
        <SectionEyebrow>COHORT SIGNAL <StatusPill tone="violet">FIRMWARE 4.7</StatusPill></SectionEyebrow>
        <div className="cohort-grid">
          <div><small>Campaign</small><strong>CAMPAIGN-OTA-47</strong></div>
          <div><small>Exposure</small><strong>12% / 12,431 VINs</strong></div>
          <div><small>Detected</small><strong>07:15:10Z</strong></div>
          <div><small>Contract</small><strong>v3 -&gt; v4</strong></div>
        </div>
      </GlassCard>
      <div className="diff-grid">
        <ContractCard title="CONTRACT V3" data={v3} active={activeVersion === 3} tone="cyan" note="Legacy interpretation" />
        <div className="diff-arrow"><ArrowRight size={23} /><span>SEMANTIC SHIFT</span></div>
        <ContractCard title="CONTRACT V4" data={v4} active={activeVersion === 4} tone="violet" note="Firmware 4.7 interpretation" />
      </div>
      <GlassCard className="diff-bottom">
        <div>
          <SectionEyebrow>DECISION IMPACT <StatusPill tone="warn">ACTIONABLE</StatusPill></SectionEyebrow>
          <h3>Why the diff matters</h3>
          <p>Without a contract-aware layer, values in the new scale remain valid JSON and valid decimals. VISTA treats the mismatch as evidence that changes trust, attribution and downstream policy decisions.</p>
        </div>
        <div className="activation-panel">
          {activeVersion === 3 ? (
            <>
              <span>RECOMMENDED NEXT CONTROL</span>
              <strong>Activate semantic contract v4</strong>
              <button className="btn btn-primary" disabled={loading} onClick={activate}>
                <Sparkles size={15} />{loading ? 'Activating...' : 'Activate v4'} <ArrowRight size={14} />
              </button>
            </>
          ) : (
            <>
              <StatusPill tone="good">NORMALIZATION APPLIED</StatusPill>
              <strong>Contract v4 is active</strong>
              <span>Decision-grade interpretation restored for the 4.7 cohort.</span>
            </>
          )}
        </div>
      </GlassCard>
    </div>
  );
}

function ContractCard({ title, data, active, tone, note }) {
  return (
    <GlassCard className={`contract-card tone-card-${tone} ${active ? 'active' : ''}`}>
      <div className="contract-card-head">
        <div>
          <div className="contract-title">{title}</div>
          <small>{note}</small>
        </div>
        <StatusPill tone={active ? 'good' : 'neutral'}>{active ? 'ACTIVE' : 'ARCHIVED'}</StatusPill>
      </div>
      <div className="contract-fields">
        {[['Unit', data.unit], ['Range', data.range], ['Sampling', data.sampling], ['Firmware', data.firmware]].map(([k, v]) => (
          <div key={k}>
            <span>{k}</span>
            <strong>{v}</strong>
          </div>
        ))}
      </div>
      <div className="json-sample">
        <span>semantic payload</span>
        <pre>{JSON.stringify({ scale: data.range === '[0, 1]' ? 'unit_interval_normalized' : '0-100', interpretation: data.range === '[0, 1]' ? 'fraction' : 'percentage' }, null, 2)}</pre>
      </div>
    </GlassCard>
  );
}
