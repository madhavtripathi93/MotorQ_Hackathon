import React, { useEffect, useState } from 'react';
import { AlertTriangle, Check, Play, Radio, Square, Zap } from 'lucide-react';
import { api } from '../api/client';

export default function Simulator() {
  const [payload, setPayload] = useState({ available: [], active: [] });
  const [selected, setSelected] = useState('ota_soc_unit_flip');
  const [firmware, setFirmware] = useState('4.7');
  const [percentage, setPercentage] = useState(12);
  const [duration, setDuration] = useState(120);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { api.getScenarios().then(setPayload).catch((e) => setError(e.message || 'Scenario catalogue unavailable.')); }, []);
  const scenario = payload.available.find((s) => s.scenario === selected);
  const start = async () => { setBusy(true); setError(''); try { const result = await api.startScenario({ scenario: selected, cohort: { firmware, percentage }, durationSeconds: Number(duration) }); setPayload((p) => ({ ...p, active: [...(p.active || []), result] })); } catch (e) { setError(e.message || 'Scenario start failed.'); } finally { setBusy(false); } };
  const stop = async (id) => { setBusy(true); setError(''); try { await api.stopScenario(id); setPayload((p) => ({ ...p, active: (p.active || []).filter((x) => x.scenarioId !== id) })); } catch (e) { setError(e.message || 'Scenario stop failed.'); } finally { setBusy(false); } };
  return <div className="vista-stack">
    {error && <div className="vista-inline-error"><AlertTriangle size={15}/>{error}</div>}
    <section className="vista-surface"><div className="vista-surface-head"><div><span className="vista-kicker">Controlled experiments</span><h2>Scenario lab</h2><p>Inject known faults so detection, attribution and recovery can be measured.</p></div><span className="vista-result-count">{payload.available.length} scenarios</span></div><div className="vista-scenario-grid">{payload.available.map((item) => <button type="button" key={item.scenario} className={`vista-scenario ${selected === item.scenario ? 'is-selected' : ''}`} onClick={() => setSelected(item.scenario)}><div><span className="vista-scenario-tag">{item.groundTruth}</span><Zap size={14}/></div><strong>{item.scenario.replaceAll('_',' ')}</strong><p>{item.description}</p></button>)}</div></section>
    <section className="vista-two-col"><article className="vista-surface"><div className="vista-surface-head"><div><h2>Injection</h2><p>{scenario?.description || 'Select a scenario.'}</p></div></div><div className="vista-form-grid"><Field label="Firmware"><select value={firmware} onChange={(e) => setFirmware(e.target.value)}><option>4.7</option><option>4.6</option></select></Field><Field label={`Cohort exposure ${percentage}%`}><input type="range" min="1" max="50" value={percentage} onChange={(e) => setPercentage(Number(e.target.value))}/></Field><Field label={`Duration ${duration}s`}><input type="range" min="30" max="300" step="30" value={duration} onChange={(e) => setDuration(Number(e.target.value))}/></Field></div><div className="vista-groundtruth"><Check size={15}/><span>Ground truth: <strong>{scenario?.groundTruth || '—'}</strong></span></div><button className="vista-primary-large" disabled={!scenario || busy} type="button" onClick={start}><Play size={15}/>{busy ? 'Starting…' : 'Start scenario'}</button></article><article className="vista-surface"><div className="vista-surface-head"><div><h2>Running</h2><p>Active simulator scenarios.</p></div><span className="vista-result-count">{payload.active.length}</span></div><div className="vista-active-scenarios">{!payload.active.length && <div className="vista-empty-state"><Radio size={19}/><strong>Simulator idle</strong><span>No fault is currently injected.</span></div>}{payload.active.map((item) => <div className="vista-active-scenario" key={item.scenarioId}><div><strong>{item.scenario.replaceAll('_',' ')}</strong><small>{item.scenarioId} · {item.groundTruth}</small></div><button className="vista-action-btn" type="button" disabled={busy} onClick={() => stop(item.scenarioId)}><Square size={12}/> Stop</button></div>)}</div></article></section>
  </div>;
}
function Field({ label, children }) { return <label className="vista-form-field"><span>{label}</span>{children}</label>; }
