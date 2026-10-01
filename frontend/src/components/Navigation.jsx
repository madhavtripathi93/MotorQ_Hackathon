import React from 'react';
import { LayoutDashboard, AlertTriangle, FileCode2, Activity, Cpu, ShieldCheck, Radio, ChevronRight, Command } from 'lucide-react';
import { BrandMark, StatusPill, SentinelAvatar } from '../ui';

const navItems = [
  { id: 'overview', label: 'Fleet Command', hint: 'Live operating picture', icon: LayoutDashboard },
  { id: 'incidents', label: 'Incidents', hint: 'Evidence + harm', icon: AlertTriangle, badge: '2' },
  { id: 'contracts', label: 'Semantic Contracts', hint: 'Meaning changes', icon: FileCode2 },
  { id: 'timeline', label: 'Trust Timeline', hint: 'Signal history', icon: Activity },
  { id: 'simulator', label: 'Chaos Console', hint: 'Fault injection', icon: Cpu },
  { id: 'decisions', label: 'Decision Gate', hint: 'Policy + AI', icon: ShieldCheck },
];

export default function Navigation({ activeTab, setActiveTab, liveStatus }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <BrandMark />
        <span className="build-tag">v1.0 / SUBMISSION</span>
      </div>
      <div className="sidebar-section-label">WORKSPACES</div>
      <nav className="nav-list">
        {navItems.map(({ id, label, hint, icon: Icon, badge }) => {
          const active = id === activeTab;
          return (
            <button key={id} className={`nav-item ${active ? 'is-active' : ''}`} onClick={() => setActiveTab(id)}>
              <span className="nav-icon"><Icon size={17} /></span>
              <span className="nav-text"><strong>{label}</strong><small>{hint}</small></span>
              {badge && <span className="nav-badge">{badge}</span>}
              {active && <ChevronRight className="nav-chevron" size={14} />}
            </button>
          );
        })}
      </nav>
      <div className="sidebar-bottom">
        <div className="sentinel-card">
          <div className="sentinel-copy">
            <div className="mini-kicker">VISTA SENTINEL</div>
            <strong>Watchtower online</strong>
            <span>Policy guardrails active</span>
          </div>
          <SentinelAvatar mood={liveStatus === 'STREAMING' ? 'calm' : 'alert'} />
        </div>
        <div className="stream-card">
          <div><Radio size={13} /><span>VERACITY STREAM</span></div>
          <StatusPill tone={liveStatus === 'STREAMING' ? 'good' : liveStatus === 'RECONNECTING' ? 'warn' : 'bad'}>
            {liveStatus}
          </StatusPill>
        </div>
        <div className="sidebar-foot"><span><Command size={12} /> Command</span><kbd>⌘K</kbd></div>
      </div>
    </aside>
  );
}
