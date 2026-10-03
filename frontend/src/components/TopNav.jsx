import React, { useState, useEffect, useRef } from 'react';
import { Activity, Bell, ChevronDown, Command, Search, X } from 'lucide-react';

const items = [
  ['overview', 'Overview'],
  ['incidents', 'Incidents'],
  ['vehicles', 'Vehicles'],
  ['contracts', 'Contracts'],
  ['trust', 'Trust'],
  ['simulator', 'Simulator'],
  ['decisions', 'Decisions'],
];

export default function TopNav({ activeTab, setActiveTab, liveStatus, query, setQuery, incidentCount }) {
  const [hoveredTab, setHoveredTab] = useState(null);
  const containerRef = useRef(null);
  const [indicatorStyle, setIndicatorStyle] = useState({ opacity: 0, left: 0, width: 0 });

  useEffect(() => {
    const targetTab = hoveredTab || activeTab;
    if (!containerRef.current) return;
    
    const targetElement = containerRef.current.querySelector(`[data-id="${targetTab}"]`);
    if (targetElement) {
      setIndicatorStyle({
        opacity: 1,
        left: targetElement.offsetLeft,
        width: targetElement.offsetWidth,
      });
    }
  }, [hoveredTab, activeTab]);

  return (
    <header className="vista-topnav">
      <div className="vista-topnav-left">
        <button className="vista-brand" type="button" onClick={() => setActiveTab('overview')}>
          <span className="vista-brand-mark"><i /></span>
          <span><strong>VISTA</strong><small>vehicle intelligence</small></span>
        </button>
      </div>

      <nav className="vista-topnav-tabs" aria-label="Workspace" ref={containerRef} onMouseLeave={() => setHoveredTab(null)}>
        <div className="vista-tab-indicator" style={indicatorStyle} />
        {items.map(([id, label]) => (
          <button 
            key={id} 
            data-id={id}
            type="button" 
            className={activeTab === id ? 'is-active' : ''} 
            onClick={() => setActiveTab(id)}
            onMouseEnter={() => setHoveredTab(id)}
          >
            {label}
            {id === 'incidents' && incidentCount > 0 && <span className="vista-tab-count">{Math.min(9, incidentCount)}</span>}
          </button>
        ))}
      </nav>

      <div className="vista-topnav-right">
        <label className="vista-command-search">
          <Search size={15} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search VIN, incident..." aria-label="Search" />
          {!query ? <span><Command size={10} /> K</span> : <button type="button" onClick={(e) => { e.preventDefault(); setQuery(''); }} aria-label="Clear search" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text)', padding: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={12}/></button>}
        </label>
        <div className={`vista-live ${liveStatus === 'CONNECTED' ? 'is-live' : liveStatus === 'OFFLINE' ? 'is-offline' : ''}`}>
          <i /> {liveStatus === 'CONNECTED' ? 'Live' : liveStatus === 'RECONNECTING' ? 'Reconnecting' : 'Offline'}
        </div>
        <button type="button" className="vista-circle-btn" onClick={() => setActiveTab('incidents')} aria-label="Notifications"><Bell size={16} />{incidentCount > 0 && <b>{Math.min(9, incidentCount)}</b>}</button>
        <button type="button" className="vista-user-menu" aria-label="Operator menu"><span>LT</span><ChevronDown size={13} /></button>
      </div>
    </header>
  );
}
