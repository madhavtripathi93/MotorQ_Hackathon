import React, { useState } from 'react';
import { Cpu, Play, Square, FastForward, Terminal, Zap, ShieldAlert, Radio, CheckCircle2, Timer, Crosshair } from 'lucide-react';
import { api } from '../api/client';
import { GlassCard, SectionEyebrow, StatusPill, MiniBars } from '../ui';

const scenarios = [
  ['ota_soc_unit_flip', 'OTA SoC unit flip', 'CONTRACT_SEMANTIC_DRIFT', 'Values compress from 0-100 into 0-1 while contract remains unchanged.'],
  ['gps_spoof', 'Adversarial GPS spoof', 'ADVERSARIAL_GPS', 'Position jumps while wheel speed / odometer remain coherent.'],
  ['sensor_spike', 'Sensor speed spike', 'SENSOR_CORRUPTION', 'Injects an impossible velocity spike >400 km/h.'],
  ['pipeline_duplicate', 'Pipeline duplicate', 'PIPELINE_DUPLICATE', 'Replays events with original sequence numbers.'],
  ['out_of_order', 'Out-of-order delay', 'PIPELINE_REORDER', 'Delays 5-15% of events by 1-30 seconds.'],
  ['silent_drop', 'Silent packet drop', 'PIPELINE_DROP', 'Creates monotonic sequence gaps.'],
  ['benign_distribution_shift', 'Benign rush-hour shift', 'BENIGN_SHIFT', 'Speed distribution changes while semantics remain valid.'],
  ['true_vehicle_event', 'Real emergency braking', 'REAL_VEHICLE_CHANGE', 'Synchronized physical changes across multiple signals.'],
  ['baseline_clean', 'Clean 100K fleet baseline', 'CLEAN', '100K VINs at 1 Hz with realistic jitter.'],
];

export default function SimulatorConsole() {
  const [selected, setSelected] = useState('ota_soc_unit_flip');
  const [firmware, setFirmware] = useState('4.7');
  const [percentage, setPercentage] = useState(12);
  const [duration, setDuration] = useState(120);
  const [active, setActive] = useState(null);
  const [loading, setLoading] = useState(false);
  const [demo, setDemo] = useState(0);

  const start = async () => {
    setLoading(true);
    try {
      setActive(await api.startScenario({
        scenario: selected,
        cohort: { firmware, percentage: Number(percentage) },
        durationSeconds: Number(duration)
      }));
    } catch {
      setActive({
        scenarioId: `preview-${Date.now()}`,
        scenario: selected,
        groundTruth: scenarios.find(s => s[0] === selected)?.[2] || 'UNKNOWN',
        status: 'PREVIEW'
      });
    } finally {
      setLoading(false);
    }
  };

  const stop = async () => {
    if (!active) return;
    setLoading(true);
    try {
      await api.stopScenario(active.scenarioId);
    } catch {} finally {
      setActive(null);
      setLoading(false);
    }
  };

  const runDemo = async () => {
    if (demo) return;
    setDemo(1); await wait(1600);
    setDemo(2); await wait(1800);
    setDemo(3); await wait(1600);
    setDemo(4); await wait(1600);
    setDemo(5); await wait(1600);
    setDemo(6); await wait(1600);
    setDemo(7); await wait(1400);
    setDemo(0);
  };

  const activeScenario = scenarios.find(s => s[0] === selected);

  return (
    <div className="dashboard-stack">
      <GlassCard className="rehearsal-card">
        <div>
          <div className="hero-badge"><span className="hero-badge-dot amber" /> DEMO REHEARSAL / 7 PHASES</div>
          <h2>Turn the chaos knob.</h2>
          <p>Inject a known fault, watch the telemetry semantics change and carry the result into VISTA's evidence and decision layers.</p>
        </div>
        <button className="btn btn-primary demo-button" onClick={runDemo}>
          <FastForward size={16} /> {demo ? `Phase ${demo}/7` : 'Run 5-minute sequence'}
        </button>
        {demo > 0 && (
          <div className="rehearsal-progress">
            <div className="rehearsal-copy">
              <span>PHASE {demo} / 7</span>
              <strong>{phaseLabel(demo)}</strong>
              <span>{Math.round((demo / 7) * 100)}%</span>
            </div>
            <div className="progress-track">
              <span style={{ width: `${(demo / 7) * 100}%` }} />
            </div>
          </div>
        )}
      </GlassCard>
      <div className="sim-grid">
        <GlassCard>
          <SectionEyebrow>FAULT CATALOG <StatusPill tone="neutral">9 SCENARIOS</StatusPill></SectionEyebrow>
          <div className="scenario-list">
            {scenarios.map(([id, label, truth, desc], i) => (
              <button
                key={id}
                className={`scenario-row ${selected === id ? 'active' : ''}`}
                onClick={() => setSelected(id)}
              >
                <span className="scenario-index">{String(i + 1).padStart(2, '0')}</span>
                <span>
                  <strong>{label}</strong>
                  <small>{desc}</small>
                </span>
                <StatusPill tone={truth.includes('CONTRACT') ? 'violet' : truth === 'CLEAN' ? 'good' : 'neutral'}>
                  {truth}
                </StatusPill>
              </button>
            ))}
          </div>
        </GlassCard>
        <div className="sim-side">
          <GlassCard>
            <SectionEyebrow>INJECTION PARAMETERS <Zap size={14} /></SectionEyebrow>
            <div className="form-grid">
              <label>Firmware
                <select value={firmware} onChange={e => setFirmware(e.target.value)}>
                  <option>4.7</option>
                  <option>4.6</option>
                </select>
              </label>
              <label>Exposure
                <strong className="range-value">{percentage}% / {Math.round(100000 * percentage / 100).toLocaleString()} VINs</strong>
                <input type="range" min="1" max="50" value={percentage} onChange={e => setPercentage(Number(e.target.value))} />
              </label>
              <label>Duration
                <input type="number" min="5" max="1800" value={duration} onChange={e => setDuration(e.target.value)} />
              </label>
            </div>
            <div className="sim-actions">
              <button className="btn btn-primary" disabled={loading || !!active} onClick={start}>
                <Play size={15} /> Start injection
              </button>
              <button className="btn btn-danger" disabled={loading || !active} onClick={stop}>
                <Square size={15} /> Stop
              </button>
            </div>
          </GlassCard>
          <GlassCard className="active-scenario">
            <SectionEyebrow>RUNTIME <Radio size={14} /></SectionEyebrow>
            {active ? (
              <div>
                <div className="runtime-top">
                  <StatusPill tone="warn">ACTIVE</StatusPill>
                  <code>{active.scenarioId}</code>
                </div>
                <h3>{activeScenario?.[1]}</h3>
                <p>Ground truth: <strong>{activeScenario?.[2]}</strong></p>
                <div className="runtime-metrics">
                  <div><span>COHORT</span><strong>{firmware}</strong></div>
                  <div><span>EXPOSURE</span><strong>{percentage}%</strong></div>
                  <div><span>DURATION</span><strong>{duration}s</strong></div>
                </div>
                <MiniBars values={[3, 8, 6, 14, 12, 18, 13, 22, 20, 28]} tone="amber" />
              </div>
            ) : (
              <div className="runtime-empty">
                <Terminal size={24} />
                <strong>Ready for injection</strong>
                <span>{activeScenario?.[3]}</span>
              </div>
            )}
          </GlassCard>
        </div>
      </div>
      <div className="system-strip">
        <div>
          <Crosshair size={15} />
          <strong>GROUND TRUTH DISCIPLINE</strong>
          <span>Every scenario carries a label so precision, recall, attribution and calibration can be measured.</span>
        </div>
        <div>
          <CheckCircle2 size={15} /> reproducible
        </div>
      </div>
    </div>
  );
}

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
function phaseLabel(n) {
  return ['', 'baseline 100K stream', 'OTA semantic drift', 'harm quantification', 'policy block', 'GPS spoof', 'resilience check', 'evidence summary'][n];
}
