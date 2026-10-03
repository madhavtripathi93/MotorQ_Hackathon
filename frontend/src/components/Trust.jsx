import React, { useMemo, useState } from 'react';
import { Activity, ArrowDownRight, ArrowUpRight, Gauge, ShieldAlert, ShieldCheck } from 'lucide-react';
import { percent, relative } from '../lib/data';

function LineChart({ events }) {
  const values = useMemo(() => events.map((e) => Number(e.trust ?? e.trustScore ?? e.trust_score)).filter(Number.isFinite).slice(0, 60).reverse(), [events]);
  if (values.length < 2) return <div className="vista-empty-state vista-chart-empty"><Activity size={21}/><strong>Waiting for trust events</strong><span>Start the simulator or wait for stream updates.</span></div>;
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const points = values.map((v, i) => `${(i/(values.length-1))*100},${94-((v-min)/span)*76}`).join(' ');
  return <svg className="vista-line-chart" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Trust history"><polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

export default function Trust({ liveEvents, selectedVehicle, onFocusVehicle }) {
  return <div className="vista-stack">
    <section className="vista-surface vista-focus-strip"><div><span className="vista-kicker">Signal history</span><h2>{selectedVehicle ? selectedVehicle.vin : 'Fleet trust stream'}</h2><p>{selectedVehicle ? `${selectedVehicle.model} · ${selectedVehicle.firmware}` : 'Every accepted trust update can be inspected from the live stream.'}</p></div><div className="vista-trust-focus"><span>Current focus</span><strong>{selectedVehicle ? 'Vehicle' : 'Fleet'}</strong></div></section>
    <section className="vista-analysis-grid vista-analysis-grid-wide"><article className="vista-surface vista-chart-panel"><div className="vista-surface-head"><div><h2>Trust trajectory</h2><p>{liveEvents.length} recent socket events</p></div><span className="vista-result-count">0 — 1</span></div><div className="vista-chart-shell"><div className="vista-axis-labels"><span>1.0</span><span>0.5</span><span>0.0</span></div><LineChart events={liveEvents}/></div></article><article className="vista-surface"><div className="vista-surface-head"><div><h2>Event stream</h2><p>Latest updates in arrival order.</p></div></div><div className="vista-event-list">{!liveEvents.length && <div className="vista-empty-state"><Activity size={18}/><span>No live trust events yet.</span></div>}{liveEvents.slice(0, 12).map((event, i) => { const trust = Number(event.trust ?? event.trustScore ?? event.trust_score); const good = Number.isFinite(trust) && trust >= .85; return <div className="vista-event-row" key={event.id || `${event.ts}-${i}`}><span className={`vista-event-icon ${good ? 'is-good' : 'is-risk'}`}>{good ? <ShieldCheck size={14}/> : <ShieldAlert size={14}/>}</span><div><strong>{event.signal || event.signal_name || 'signal update'}</strong><small>{event.vin || event.vehicleVin || 'VIN unavailable'} · {relative(event.ts || event.timestamp || event.receivedAt)}</small></div><span className={good ? 'is-good' : 'is-risk'}>{Number.isFinite(trust) ? trust.toFixed(2) : '—'}</span></div>})}</div></article></section>
  </div>;
}
