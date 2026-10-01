import React, { useEffect, useState } from 'react';

export function useCountUp(target = 0, duration = 700) {
  const [value, setValue] = useState(Number(target) || 0);
  useEffect(() => {
    const end = Number(target) || 0;
    const start = value;
    if (Math.abs(end - start) < 0.01) return;
    let raf = 0;
    const started = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - started) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(start + (end - start) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return value;
}

export function AnimatedNumber({ value, suffix = '', decimals = 0, className = '' }) {
  const v = useCountUp(Number(value) || 0, 800);
  return (
    <span className={className}>
      {v.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </span>
  );
}

export function BrandMark({ compact = false }) {
  return (
    <div className="brand-block">
      <div className="brand-mark" aria-hidden="true">
        <span className="brand-core" />
        <span className="brand-arc brand-arc-a" />
        <span className="brand-arc brand-arc-b" />
      </div>
      {!compact && (
        <div className="brand-copy">
          <div className="brand-name">VISTA</div>
          <div className="brand-subtitle">Signal Trust / Assurance</div>
        </div>
      )}
    </div>
  );
}

export function StatusPill({ children, tone = 'neutral', dot = true }) {
  return (
    <span className={`status-pill status-${tone}`}>
      {dot && <i className="status-dot" />}
      {children}
    </span>
  );
}

export function SectionEyebrow({ children, right }) {
  return (
    <div className="section-eyebrow">
      <span>{children}</span>
      {right}
    </div>
  );
}

export function GlassCard({ children, className = '', glow = '' }) {
  return (
    <section className={`glass-card ${glow ? `glow-${glow}` : ''} ${className}`}>
      {children}
    </section>
  );
}

export function MetricCard({ icon, label, value, suffix = '', meta, tone = 'cyan', foot }) {
  return (
    <GlassCard className="metric-card" glow={tone}>
      <div className="metric-top">
        <div className={`icon-orb icon-${tone}`}>{icon}</div>
        <span className="metric-label">{label}</span>
      </div>
      <div className="metric-value">
        <AnimatedNumber value={value} suffix={suffix} decimals={typeof value === 'number' && value < 10 ? 1 : 0} />
      </div>
      {meta && <div className="metric-meta">{meta}</div>}
      {foot && <div className="metric-foot">{foot}</div>}
    </GlassCard>
  );
}

export function MiniBars({ values = [], tone = 'cyan' }) {
  const max = Math.max(...values, 1);
  return (
    <div className={`mini-bars tone-${tone}`} aria-hidden="true">
      {values.map((v, i) => (
        <span
          key={i}
          style={{
            height: `${Math.max(8, (v / max) * 100)}%`,
            animationDelay: `${i * 40}ms`
          }}
        />
      ))}
    </div>
  );
}

export function Sparkline({ values = [], tone = 'cyan', height = 86 }) {
  if (!values.length) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / Math.max(values.length - 1, 1)) * 100;
    const y = 88 - ((v - min) / range) * 72;
    return `${x},${y}`;
  }).join(' ');
  const area = `0,90 ${pts} 100,90`;
  return (
    <svg className={`sparkline tone-${tone}`} viewBox="0 0 100 100" preserveAspectRatio="none" style={{ height }} role="img" aria-label="Trend chart">
      <polygon className="spark-area" points={area} />
      <polyline className="spark-line" points={pts} />
    </svg>
  );
}

export function TrustOrb({ score = 0.94, size = 188, label = 'TRUST' }) {
  const pct = Math.max(0, Math.min(1, Number(score) || 0));
  const radius = 64;
  const c = 2 * Math.PI * radius;
  const dash = c * pct;
  return (
    <div className="trust-orb" style={{ width: size, height: size }}>
      <div className="trust-orb-glow" />
      <svg viewBox="0 0 160 160" className="trust-ring">
        <circle cx="80" cy="80" r={radius} className="trust-track" />
        <circle
          cx="80"
          cy="80"
          r={radius}
          className="trust-progress"
          style={{
            strokeDasharray: `${dash} ${c}`,
            transformOrigin: '80px 80px'
          }}
        />
      </svg>
      <div className="trust-center">
        <div className="trust-score">{pct.toFixed(2)}</div>
        <div className="trust-label">{label}</div>
      </div>
    </div>
  );
}

export function HolographicVehicle({ severity = 'nominal' }) {
  return (
    <div className={`vehicle-scene severity-${severity}`}>
      <div className="vehicle-grid" />
      <div className="vehicle-halo halo-a" />
      <div className="vehicle-halo halo-b" />
      <svg className="vehicle-svg" viewBox="0 0 520 260" aria-label="Abstract holographic vehicle visualization">
        <defs>
          <linearGradient id="carBody" x1="0" x2="1">
            <stop offset="0" stopColor="rgba(96,232,255,.14)" />
            <stop offset=".5" stopColor="rgba(137,99,255,.28)" />
            <stop offset="1" stopColor="rgba(255,255,255,.08)" />
          </linearGradient>
          <linearGradient id="carStroke" x1="0" x2="1">
            <stop offset="0" stopColor="#58e6ff" />
            <stop offset=".55" stopColor="#a37cff" />
            <stop offset="1" stopColor="#74f6d3" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <g className="vehicle-orbit orbit-one"><ellipse cx="260" cy="134" rx="210" ry="66" /></g>
        <g className="vehicle-orbit orbit-two"><ellipse cx="260" cy="134" rx="160" ry="46" /></g>
        <g filter="url(#glow)" transform="translate(54,44)">
          <path d="M76 144 L98 116 L154 90 L239 78 L322 84 L380 111 L406 145 L393 174 L84 174 Z" fill="url(#carBody)" stroke="url(#carStroke)" strokeWidth="2.2" />
          <path d="M160 91 L191 54 L300 54 L334 84" fill="none" stroke="url(#carStroke)" strokeWidth="2" />
          <path d="M172 88 L198 62 L246 62 L248 87 M256 87 L256 62 L295 62 L322 84" fill="rgba(87,111,180,.15)" stroke="rgba(115,223,255,.8)" strokeWidth="1.2" />
          <circle cx="132" cy="171" r="24" fill="rgba(7,10,18,.92)" stroke="#58e6ff" strokeWidth="2" />
          <circle cx="354" cy="171" r="24" fill="rgba(7,10,18,.92)" stroke="#a37cff" strokeWidth="2" />
          <circle cx="132" cy="171" r="9" fill="rgba(88,230,255,.7)" />
          <circle cx="354" cy="171" r="9" fill="rgba(163,124,255,.7)" />
          <path d="M90 143 H395" stroke="rgba(255,255,255,.15)" strokeWidth="1" />
          <path d="M111 123 C166 107 311 104 382 122" fill="none" stroke="rgba(117,246,211,.32)" strokeWidth="2" strokeDasharray="8 8" />
          <circle cx="262" cy="122" r="5" fill="#fff" />
        </g>
      </svg>
      <div className="vehicle-readout readout-a"><span>GPS</span><strong>LOCKED</strong></div>
      <div className="vehicle-readout readout-b"><span>CAN BUS</span><strong>1.0kHz</strong></div>
      <div className="vehicle-readout readout-c"><span>COHORT</span><strong>4.7</strong></div>
    </div>
  );
}

export function SentinelAvatar({ mood = 'calm' }) {
  return (
    <div className={`sentinel-avatar mood-${mood}`} aria-label="VISTA investigation sentinel">
      <div className="sentinel-aura aura-one" />
      <div className="sentinel-aura aura-two" />
      <div className="sentinel-head">
        <div className="sentinel-visor"><span /><span /></div>
        <div className="sentinel-notch" />
      </div>
      <div className="sentinel-body">
        <span className="sentinel-core" />
        <span className="sentinel-line l1" />
        <span className="sentinel-line l2" />
      </div>
    </div>
  );
}

export function CauseBar({ label, value, tone = 'cyan' }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className="cause-row">
      <div className="cause-head"><span>{label}</span><strong>{pct.toFixed(0)}%</strong></div>
      <div className="cause-track">
        <span className={`cause-fill fill-${tone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function IconButton({ children, label, onClick, className = '' }) {
  return (
    <button className={`icon-button ${className}`} onClick={onClick} aria-label={label} title={label}>
      {children}
    </button>
  );
}

export function Toast({ tone = 'info', title, message, onClose }) {
  return (
    <div className={`toast toast-${tone}`} role="status">
      <div><strong>{title}</strong><span>{message}</span></div>
      <IconButton label="Dismiss" onClick={onClose}>×</IconButton>
    </div>
  );
}
