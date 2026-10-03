import React from 'react';
import { Radar, Signal, ShieldCheck } from 'lucide-react';

export default function VisualField({ trust = null, incidents = 0, liveEvents = 0 }) {
  const trustPct = typeof trust === 'number' && trust >= 0 ? Math.round(trust * 100) : null;
  return (
    <div className="vista-visual-field" aria-label="VISTA live signal field">
      <div className="vista-field-sky" />
      <div className="vista-field-grid" />
      <div className="vista-field-rings"><i /><i /><i /></div>
      <div className="vista-scanline" />
      <div className="vista-field-node node-a"><Signal size={13} /><span>RAW</span></div>
      <div className="vista-field-node node-b"><Radar size={13} /><span>COHORT</span></div>
      <div className="vista-field-node node-c"><ShieldCheck size={13} /><span>TRUST</span></div>
      <div className="vista-car">
        <div className="vista-car-glow" />
        <svg viewBox="0 0 520 230" aria-hidden="true">
          <defs>
            <linearGradient id="vistaCarBody" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#c9f0e8" stopOpacity=".72" />
              <stop offset=".55" stopColor="#83b5d7" stopOpacity=".58" />
              <stop offset="1" stopColor="#253447" stopOpacity=".88" />
            </linearGradient>
            <filter id="vistaGlow"><feGaussianBlur stdDeviation="7" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          </defs>
          <path d="M76 160c13-33 50-69 90-82l49-45h119l55 40c30 4 55 18 67 40l21 47c3 7-3 16-11 16H86c-8 0-13-8-10-16Z" fill="url(#vistaCarBody)" stroke="#ccefe8" strokeOpacity=".78" strokeWidth="3" filter="url(#vistaGlow)"/>
          <path d="M209 40 180 77h180l-39-37H209Z" fill="#101b2a" fillOpacity=".88" stroke="#82c1d0" strokeOpacity=".55" />
          <path d="M113 112h301" stroke="#c7f0e4" strokeOpacity=".32" strokeWidth="2" strokeDasharray="8 9" />
          <circle cx="151" cy="167" r="27" fill="#07111b" stroke="#b4e8df" strokeWidth="4"/><circle cx="151" cy="167" r="10" fill="#daeef0"/>
          <circle cx="388" cy="167" r="27" fill="#07111b" stroke="#f4c98b" strokeWidth="4"/><circle cx="388" cy="167" r="10" fill="#f8e2bf"/>
          <path d="M92 145c61 10 170 17 331 2" stroke="#f0d6aa" strokeOpacity=".22" strokeWidth="4" />
        </svg>
      </div>
      <div className="vista-field-readout readout-a"><small>Fleet trust</small><strong>{trustPct === null ? '—' : `${trustPct}%`}</strong></div>
      <div className="vista-field-readout readout-b"><small>Incidents</small><strong>{incidents}</strong></div>
      <div className="vista-field-readout readout-c"><small>Stream events</small><strong>{liveEvents}</strong></div>
      <div className="vista-field-caption"><span><i /> decision-grade signal field</span><span>1Hz baseline</span></div>
    </div>
  );
}
