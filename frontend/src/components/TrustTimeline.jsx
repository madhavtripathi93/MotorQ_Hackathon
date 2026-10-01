import React, { useEffect, useState } from 'react';
import { Activity, Search, RefreshCw, Signal, CircleDot, Clock3, ShieldCheck, ChevronDown } from 'lucide-react';
import { api, createSocketConnection } from '../api/client';
import { GlassCard, SectionEyebrow, StatusPill, Sparkline, TrustOrb } from '../ui';

const presetVins = ['VIN-000012', 'VIN-000088', 'VIN-000100', 'VIN-000500'];
const demoEvents = [
  { ts: '2026-10-01T07:15:10Z', val: '0.72', trust: 0.12, conf: 0.94, status: 'QUARANTINED', note: 'Contract drift candidate / firmware 4.7', reasons: ['UNIT_SCALE_INVERSION', 'DID_COHORT_DIVERGENCE'] },
  { ts: '2026-10-01T07:15:07Z', val: '0.71', trust: 0.18, conf: 0.90, status: 'REVIEW', note: 'Cohort divergence detected', reasons: ['DRIFT_WINDOW'] },
  { ts: '2026-10-01T07:14:54Z', val: '71.0', trust: 0.93, conf: 0.92, status: 'DECISION-GRADE', note: 'Pre-rollout contract v3', reasons: ['FRESH', 'IN_RANGE', 'CONTRACT_MATCH'] },
];

export default function TrustTimeline() {
  const [selectedVin, setSelectedVin] = useState('VIN-000012');
  const [selectedSignal, setSelectedSignal] = useState('battery_soc');
  const [events, setEvents] = useState([]);
  const [latestTrust, setLatestTrust] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchTrust = async (vin = selectedVin, signal = selectedSignal) => {
    setLoading(true);
    try {
      const data = await api.getVehicleTrust(vin, signal);
      setLatestTrust(data);
      if (data?.observedAt) setEvents(prev => [{ ts: data.observedAt, val: String(data.value), trust: data.trust, conf: data.confidence, status: data.trust >= 0.5 ? 'DECISION-GRADE' : 'QUARANTINED', note: `Signal ${data.signal}`, reasons: data.reasonCodes || [] }, ...prev].slice(0, 12));
    } catch {
      setLatestTrust({ vin, signal, value: signal === 'battery_soc' ? 0.72 : 55, trust: 0.12, confidence: 0.94 });
      setEvents(prev => prev.length ? prev : demoEvents);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    fetchTrust();
    const socket = createSocketConnection();
    const add = record => {
      if (!record || (record.vin && record.vin !== selectedVin)) return;
      setEvents(prev => [{
        ts: record.timestamp || new Date().toISOString(),
        val: String(record.observedValue),
        trust: record.trust,
        conf: record.confidence,
        status: record.trust >= 0.5 ? 'DECISION-GRADE' : 'QUARANTINED',
        note: record.topClass ? `Attributed cause: ${record.topClass}` : 'Live veracity update',
        reasons: record.reasonCodes || record.evidence || []
      }, ...prev].slice(0, 12));
    };
    socket.on('trust.updated', add);
    socket.on('trust.quarantined', add);
    return () => socket.disconnect();
  }, [selectedVin, selectedSignal]);

  const trust = Number(latestTrust?.trust ?? events[0]?.trust ?? 0);

  return (
    <div className="dashboard-stack">
      <GlassCard className="timeline-toolbar">
        <div className="control-group">
          <div className="search-control">
            <Search size={15} />
            <input value={selectedVin} onChange={e => setSelectedVin(e.target.value)} placeholder="VIN-000012" />
          </div>
          <select value={selectedSignal} onChange={e => setSelectedSignal(e.target.value)}>
            <option value="battery_soc">battery_soc</option>
            <option value="speed_kmh">speed_kmh</option>
            <option value="location_gps">location_gps</option>
          </select>
          <button className="btn btn-secondary" onClick={() => fetchTrust()}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Poll trust
          </button>
        </div>
        <div className="quick-vins">
          {presetVins.map(v => (
            <button key={v} onClick={() => setSelectedVin(v)} className={selectedVin === v ? 'selected' : ''}>
              {v}
            </button>
          ))}
        </div>
      </GlassCard>
      <div className="timeline-layout">
        <GlassCard className="timeline-main">
          <SectionEyebrow>LIVE SIGNAL HISTORY <StatusPill tone="good">SOCKET.IO</StatusPill></SectionEyebrow>
          <div className="timeline-head">
            <div>
              <h3>{selectedVin} / {selectedSignal}</h3>
              <p>Every decision is anchored to the event that changed the trust state.</p>
            </div>
            <TrustOrb score={trust} size={130} label="LATEST" />
          </div>
          <Sparkline values={[86, 91, 93, 94, 92, 90, 84, 61, 46, 27, 18, 12]} tone="violet" height={150} />
          <div className="event-stack">
            {events.map((ev, i) => (
              <div className="event-card" key={`${ev.ts}-${i}`}>
                <div className="event-time">
                  <Clock3 size={12} />
                  <span>{new Date(ev.ts).toLocaleTimeString()}</span>
                </div>
                <div className="event-value">
                  <strong>{ev.val}</strong>
                  <span>{ev.note}</span>
                </div>
                <div className="event-reasons">
                  {ev.reasons?.slice(0, 2).map(r => <span key={r}>{r}</span>)}
                </div>
                <div className={`event-trust ${ev.trust < 0.5 ? 'bad' : 'good'}`}>
                  <strong>{Number(ev.trust).toFixed(2)}</strong>
                  <small>{Math.round(Number(ev.conf || 0) * 100)}% conf</small>
                </div>
                <StatusPill tone={ev.trust < 0.5 ? 'bad' : 'good'}>{ev.status}</StatusPill>
              </div>
            ))}
          </div>
        </GlassCard>
        <div className="timeline-side">
          <GlassCard>
            <SectionEyebrow>SIGNAL CONTEXT <Signal size={14} /></SectionEyebrow>
            <div className="context-list">
              <ContextRow icon={<Signal size={15} />} k="Source" v="BMS_PRIMARY" />
              <ContextRow icon={<ShieldCheck size={15} />} k="Contract" v="battery_soc v3" />
              <ContextRow icon={<Activity size={15} />} k="Cadence" v="1.0 Hz" />
              <ContextRow icon={<CircleDot size={15} />} k="Cohort" v="Firmware 4.7" />
            </div>
          </GlassCard>
          <GlassCard>
            <SectionEyebrow>EVENT LEGEND <ChevronDown size={14} /></SectionEyebrow>
            <div className="legend-stack">
              <span><i className="legend-dot green" /> Decision-grade</span>
              <span><i className="legend-dot amber" /> Review window</span>
              <span><i className="legend-dot red" /> Quarantined</span>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

function ContextRow({ icon, k, v }) {
  return (
    <div className="context-row">
      <span>{icon}</span>
      <small>{k}</small>
      <strong>{v}</strong>
    </div>
  );
}
