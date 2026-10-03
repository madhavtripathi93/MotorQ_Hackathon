import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ExternalLink, FileCode2, LoaderCircle, ShieldCheck, X } from 'lucide-react';
import { api } from '../api/client';
import { percent, time, titleForIncident } from '../lib/data';

const tabs = ['Overview', 'Evidence', 'Contract'];

export default function IncidentDrawer({ incident, onClose, onNavigate }) {
  const [tab, setTab] = useState('Overview');
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!incident?.id) return;
      setLoading(true); setError('');
      try {
        const response = await api.getIncidentEvidence(incident.id);
        if (active) setDetail(response);
      } catch (e) {
        if (active) setError(e.message || 'Evidence request failed.');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [incident?.id]);

  const evidence = useMemo(() => {
    const source = detail?.evidence ?? detail?.items ?? detail?.data ?? [];
    return Array.isArray(source) ? source : [];
  }, [detail]);
  const harm = detail?.harmQuantification ?? incident?.harm ?? {};

  return <div className="vista-drawer-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
    <aside className="vista-drawer" role="dialog" aria-modal="true" aria-label="Incident investigation">
      <div className="vista-drawer-top">
        <div><span className="vista-kicker">Incident investigation</span><h2>{titleForIncident(incident)}</h2><span className="vista-mono vista-drawer-id">{incident.id || 'Incident ID unavailable'}</span></div>
        <button type="button" className="vista-close-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
      </div>
      <div className="vista-drawer-status"><span className={`vista-severity-tag severity-tag-${String(incident.severity).toLowerCase()}`}><i />{incident.severity}</span><span className="vista-status-tag">{incident.status}</span><span>{time(incident.createdAt)}</span></div>
      <div className="vista-drawer-tabs" role="tablist">{tabs.map((label) => <button type="button" key={label} role="tab" aria-selected={tab === label} className={tab === label ? 'is-active' : ''} onClick={() => setTab(label)}>{label}</button>)}</div>

      <div className="vista-drawer-scroll">
        {tab === 'Overview' && <div className="vista-drawer-content">
          <div className="vista-drawer-grid"><div><small>VIN</small><strong className="vista-mono">{incident.vin}</strong></div><div><small>Signal</small><strong>{incident.signal}</strong></div><div><small>Cause</small><strong>{incident.cause}</strong></div><div><small>Trust</small><strong>{incident.trust == null ? '—' : percent(incident.trust)}</strong></div></div>
          <section className="vista-drawer-card"><header><span>Decision posture</span><ShieldCheck size={15} /></header><p>{incident.trust != null && incident.trust >= .85 ? 'Trust is within decision-grade range. Confirm evidence before taking a consequential action.' : 'Trust is below or unavailable for the decision-grade threshold. Keep consequential actions gated pending review.'}</p></section>
          <section className="vista-drawer-card"><header><span>Downstream harm</span><AlertTriangle size={15} /></header><div className="vista-harm-grid"><div><small>Affected events</small><strong>{harm?.affected_events ?? harm?.affectedEvents ?? '—'}</strong></div><div><small>Range error</small><strong>{harm?.range_error_km ?? harm?.rangeErrorKm ?? '—'}</strong></div><div><small>Cost / exposure</small><strong>{harm?.estimated_cost ?? harm?.estimatedCost ?? '—'}</strong></div></div></section>
          <div className="vista-drawer-actions"><button type="button" className="vista-action-btn" onClick={() => onNavigate('trust')}>Open trust timeline <ExternalLink size={14} /></button><button type="button" className="vista-action-btn is-primary" onClick={() => onNavigate('decisions')}>Review in decision gate <ExternalLink size={14} /></button></div>
        </div>}

        {tab === 'Evidence' && <div className="vista-drawer-content">
          {loading && <div className="vista-empty-state"><LoaderCircle className="vista-spin" size={20} /><span>Loading forensic evidence…</span></div>}
          {!loading && error && <div className="vista-error-card"><AlertTriangle size={16} /><span>{error}</span></div>}
          {!loading && !error && !evidence.length && <div className="vista-empty-state"><CheckCircle2 size={20} /><strong>No evidence returned</strong><span>The incident endpoint returned no evidence records.</span></div>}
          {!loading && !error && evidence.map((item, i) => <article className="vista-evidence-card" key={item.id || item.evidence_code || i}><div><strong>{item.evidence_code || item.code || item.type || `Evidence ${i + 1}`}</strong><small>{item.recorded_at ? time(item.recorded_at) : ''}</small></div><p>{item.description || 'No description returned.'}</p><pre>{JSON.stringify(item.payload || {}, null, 2)}</pre></article>)}
        </div>}

        {tab === 'Contract' && <div className="vista-drawer-content"><section className="vista-drawer-card"><header><span>Semantic contract context</span><FileCode2 size={15} /></header><p>Open the Contracts workspace to inspect the versioned meaning of <code>{incident.signal}</code> and compare the expected contract with the observed payload behavior.</p><button type="button" className="vista-action-btn is-primary" onClick={() => onNavigate('contracts')}>Open contracts <ExternalLink size={14} /></button></section><section className="vista-drawer-card"><header><span>Current incident link</span></header><div className="vista-drawer-grid"><div><small>Firmware</small><strong>{incident.firmware || '—'}</strong></div><div><small>OTA campaign</small><strong>{incident.campaign || '—'}</strong></div></div></section></div>}
      </div>

      <footer className="vista-drawer-footer"><button type="button" className="vista-action-btn" onClick={onClose}>Close</button><button type="button" className="vista-action-btn is-primary" onClick={() => onNavigate('decisions')}>Decision gate <ExternalLink size={14} /></button></footer>
    </aside>
  </div>;
}
