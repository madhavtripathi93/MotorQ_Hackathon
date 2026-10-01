import React, { useEffect, useState } from 'react';
import Navigation from './components/Navigation';
import FleetOverview from './components/FleetOverview';
import IncidentDetail from './components/IncidentDetail';
import ContractDiff from './components/ContractDiff';
import TrustTimeline from './components/TrustTimeline';
import SimulatorConsole from './components/SimulatorConsole';
import DecisionPanel from './components/DecisionPanel';
import { api, createSocketConnection } from './api/client';
import { BrandMark, IconButton, StatusPill, Toast } from './ui';
import { Bell, Command, Search, Wifi, ShieldCheck } from 'lucide-react';

const pageMeta = {
  overview: ['Fleet Command', 'Live trust posture across the connected vehicle network'],
  incidents: ['Incident Investigation', 'Trace the evidence chain from signal anomaly to impact'],
  contracts: ['Semantic Contracts', 'See exactly when the meaning of a signal changes'],
  timeline: ['Trust Timeline', 'Inspect the decision history for any vehicle signal'],
  simulator: ['Chaos Console', 'Inject realistic faults and verify the veracity pipeline'],
  decisions: ['Decision Gate', 'Separate evidence, AI proposal, policy and action'],
};

export default function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [metrics, setMetrics] = useState(null);
  const [liveEvents, setLiveEvents] = useState([]);
  const [liveStatus, setLiveStatus] = useState('STREAMING');
  const [toast, setToast] = useState(null);
  const [commandOpen, setCommandOpen] = useState(false);

  useEffect(() => {
    let socket;
    let interval;
    const init = async () => {
      if (!api.token) {
        try { await api.login(); } catch (e) { setLiveStatus('AUTH REQUIRED'); }
      }
      const fetchMetrics = async () => {
        try { setMetrics(await api.getMetrics()); } catch (e) { /* authoritative panels handle their own empty state */ }
      };
      await fetchMetrics();
      interval = setInterval(fetchMetrics, 5000);
      socket = createSocketConnection();
      socket.on('connect', () => setLiveStatus('STREAMING'));
      socket.on('disconnect', () => setLiveStatus('RECONNECTING'));
      socket.on('connect_error', () => setLiveStatus('OFFLINE'));
      socket.on('trust.updated', (payload) => {
        setLiveEvents(prev => [payload, ...prev].slice(0, 8));
      });
      socket.on('incident.created', () => {
        setToast({ tone: 'danger', title: 'New incident detected', message: 'VISTA created a fresh evidence record.' });
        setTimeout(() => setToast(null), 5000);
      });
    };
    init();
    return () => { if (interval) clearInterval(interval); if (socket) socket.disconnect(); };
  }, []);

  const [title, subtitle] = pageMeta[activeTab];
  const content = {
    overview: <FleetOverview metrics={metrics} liveEvents={liveEvents} onSelectIncident={() => setActiveTab('incidents')} />,
    incidents: <IncidentDetail />,
    contracts: <ContractDiff />,
    timeline: <TrustTimeline />,
    simulator: <SimulatorConsole />,
    decisions: <DecisionPanel />,
  }[activeTab];

  const navTo = (tab) => { setActiveTab(tab); setCommandOpen(false); };

  return (
    <div className="app-container">
      <div className="ambient ambient-one" /><div className="ambient ambient-two" /><div className="ambient ambient-three" />
      <Navigation activeTab={activeTab} setActiveTab={navTo} liveStatus={liveStatus} />
      <main className="main-content">
        <header className="top-bar">
          <div className="mobile-brand"><BrandMark compact /></div>
          <div className="breadcrumbs"><span>VISTA</span><b>/</b><strong>{title}</strong></div>
          <div className="top-actions">
            <button className="command-trigger" onClick={() => setCommandOpen(v => !v)}>
              <Command size={15} />
              <span>Command</span><kbd>⌘K</kbd>
            </button>
            <IconButton label="Search"><Search size={17} /></IconButton>
            <IconButton label="Notifications"><Bell size={17} /></IconButton>
            <div className="operator-chip">
              <div className="operator-avatar">LT</div>
              <div><strong>Lead Investigator</strong><span>OPERATOR-001</span></div>
            </div>
          </div>
        </header>
        <div className="command-strip">
          <div>
            <StatusPill tone={liveStatus === 'STREAMING' ? 'good' : liveStatus === 'RECONNECTING' ? 'warn' : 'bad'}>
              {liveStatus}
            </StatusPill>
            <span className="subtle-divider" />
            <span className="top-context">tenant-default <b>·</b> North America EV Fleet</span>
          </div>
          <div className="secure-context">
            <ShieldCheck size={14} /> JWT / RBAC <span>OPERATOR</span><Wifi size={14} />
          </div>
        </div>
        {commandOpen && (
          <div className="command-menu">
            <div className="command-search">
              <Search size={15} />
              <input
                autoFocus
                placeholder="Jump to a VISTA workspace..."
                onKeyDown={(e) => {
                  const key = e.key.toLowerCase();
                  const match = Object.keys(pageMeta).find(k => k.startsWith(key));
                  if (match) navTo(match);
                }}
              />
            </div>
            {Object.entries(pageMeta).map(([key, [label, desc]]) => (
              <button key={key} onClick={() => navTo(key)}>
                <span>{label}</span><small>{desc}</small>
              </button>
            ))}
          </div>
        )}
        <section className="page-head">
          <div>
            <div className="page-kicker">CONTROL PLANE <span>•</span> DECISION GRADE</div>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          <div className="page-head-right">
            <StatusPill tone="neutral">100K VEHICLE MODEL</StatusPill>
            <span className="live-clock">LIVE / 1Hz BASELINE</span>
          </div>
        </section>
        <div className="content-body page-transition" key={activeTab}>{content}</div>
        {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      </main>
    </div>
  );
}
