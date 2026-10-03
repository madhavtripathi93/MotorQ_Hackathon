import React from 'react';
import { Activity, BadgeAlert, CarFront, FileCode2, Gauge, Layers3, ShieldCheck, SlidersHorizontal } from 'lucide-react';

const items = [
  ['overview', 'Overview'], ['incidents', 'Incidents'], ['vehicles', 'Vehicles'], ['contracts', 'Contracts'], ['trust', 'Trust'], ['simulator', 'Simulator'], ['decisions', 'Decisions'],
];
const icons = { overview: Layers3, incidents: BadgeAlert, vehicles: CarFront, contracts: FileCode2, trust: Activity, simulator: Gauge, decisions: ShieldCheck };

export default function Navigation({ activeTab, setActiveTab, incidentCount }) {
  return <nav className="vista-side-rail" aria-label="Primary workspace">
    <button className="vista-side-brand" type="button" onClick={() => setActiveTab('overview')}><span className="vista-side-mark"><i/></span><span><strong>VISTA</strong><small>signal assurance</small></span></button>
    <div className="vista-side-section"><span>Workspace</span>{items.map(([id, label]) => { const Icon = icons[id]; return <button className={`vista-side-link ${activeTab === id ? 'is-active' : ''}`} type="button" key={id} onClick={() => setActiveTab(id)} aria-current={activeTab === id ? 'page' : undefined}><span className="vista-side-icon"><Icon size={16}/></span><span>{label}</span>{id === 'incidents' && incidentCount > 0 && <b>{Math.min(9, incidentCount)}</b>}</button>; })}</div>
    <div className="vista-side-bottom"><div className="vista-sentinel"><div className="vista-sentinel-ring"><span/></div><span><small>VISTA Sentinel</small><strong>Watchtower online</strong></span></div><div className="vista-side-note"><SlidersHorizontal size={13}/><span><strong>Policy guarded</strong><small>Evidence before action</small></span></div></div>
  </nav>;
}
