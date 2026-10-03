import React, { useState } from 'react';
import { ArrowRight, CheckCircle2, LockKeyhole, ShieldAlert, ShieldCheck } from 'lucide-react';
import { api } from '../api/client';

const actions = [
  ['dispatch_recovery', 'Dispatch physical recovery', 'location_gps'],
  ['recalibrate_range', 'Recalibrate EV range', 'battery_soc'],
  ['driver_penalty_point', 'Driver penalty assessment', 'speed_kmh'],
  ['high_voltage_isolation', 'High-voltage isolation', 'battery_soc'],
  ['automated_charge_schedule', 'Automated charge schedule', 'battery_soc'],
];

export default function Decisions({ selectedVehicle, selectedIncident }) {
  const [vin, setVin] = useState(selectedVehicle?.vin || selectedIncident?.vin || '');
  const [action, setAction] = useState(actions[0][0]);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const evaluate = async () => { setBusy(true); setError(''); try { const data = await api.evaluateDecision({ vin, requestedAction: action, incidentId: selectedIncident?.id || undefined }); setResult(data); } catch (e) { setError(e.message || 'Decision evaluation failed.'); } finally { setBusy(false); } };
  return <div className="vista-stack">
    <section className="vista-surface vista-decision-hero"><div><span className="vista-kicker">Policy gate</span><h2>Consequential actions require trustworthy signals.</h2><p>The model may explain. The deterministic policy decides.</p></div><div className="vista-policy-mark"><LockKeyhole size={21}/><span>Fail closed</span></div></section>
    <section className="vista-two-col"><article className="vista-surface"><div className="vista-surface-head"><div><h2>Evaluate action</h2><p>Uses the existing decision API and current tenant-scoped trust state.</p></div></div><div className="vista-form-grid"><label className="vista-form-field"><span>Vehicle VIN</span><input className="vista-input" value={vin} onChange={(e) => setVin(e.target.value)} placeholder="VIN-000012"/></label><label className="vista-form-field"><span>Requested action</span><select value={action} onChange={(e) => setAction(e.target.value)}>{actions.map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label></div>{selectedIncident && <div className="vista-context-strip"><ShieldAlert size={14}/><span>Incident context: <strong>{selectedIncident.id}</strong> · {selectedIncident.cause}</span></div>}<button className="vista-primary-large" disabled={!vin || busy} type="button" onClick={evaluate}><ShieldCheck size={15}/>{busy ? 'Evaluating…' : 'Evaluate against policy'}</button>{error && <div className="vista-inline-error">{error}</div>}</article>
      <article className="vista-surface">{!result ? <div className="vista-empty-state vista-decision-empty"><ArrowRight size={20}/><strong>No decision yet</strong><span>Choose an action and evaluate it against current trust and evidence.</span></div> : <DecisionResult result={result}/>}</article></section>
  </div>;
}
function DecisionResult({ result }) { const outcome = String(result.outcome || '').toUpperCase(); const cls = outcome === 'ALLOW' ? 'good' : outcome === 'REVIEW' ? 'warn' : 'bad'; return <div className="vista-decision-result"><div className={`vista-outcome vista-outcome-${cls}`}><div>{outcome === 'ALLOW' ? <CheckCircle2 size={20}/> : <ShieldAlert size={20}/>}</div><span><small>Policy outcome</small><strong>{outcome || 'UNKNOWN'}</strong></span></div><div className="vista-decision-metrics"><div><small>Actual trust</small><strong>{result.actual_trust == null ? '—' : Number(result.actual_trust).toFixed(2)}</strong></div><div><small>Threshold</small><strong>{result.trust_threshold == null ? '—' : Number(result.trust_threshold).toFixed(2)}</strong></div><div><small>Policy</small><strong>{result.policy_code || '—'}</strong></div></div><p className="vista-decision-reason">{result.reason_details?.reason || result.reason || 'No reason returned.'}</p></div>; }
