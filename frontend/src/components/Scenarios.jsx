import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { Play, Square, Activity, Shield, Zap, RefreshCw, Clock, AlertCircle, MapPin, UploadCloud, Cpu, AlertTriangle, ShieldAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

const getScenarioIcon = (id, groundTruth) => {
  if (id === 'baseline_clean') return <Shield size={20} color="var(--primary-green)" />;
  if (id === 'sensor_spike') return <Zap size={20} color="var(--accent-yellow)" />;
  if (id === 'pipeline_duplicate') return <RefreshCw size={20} color="var(--primary-blue)" />;
  if (id === 'out_of_order') return <Clock size={20} color="#a855f7" />;
  if (id === 'silent_drop') return <AlertCircle size={20} color="var(--accent-red)" />;
  if (id === 'gps_spoof') return <MapPin size={20} color="#f97316" />;
  if (groundTruth === 'CONTRACT_SEMANTIC_DRIFT') return <UploadCloud size={20} color="var(--primary-blue)" />;
  if (groundTruth === 'REAL_VEHICLE_CHANGE') return <Cpu size={20} color="var(--primary-green)" />;
  return <Activity size={20} color="var(--text-secondary)" />;
};

export default function Scenarios({ query = '' }) {
  const [scenarios, setScenarios] = useState([]);
  const [selectedScenario, setSelectedScenario] = useState(null);
  const [activeRun, setActiveRun] = useState(null);

  useEffect(() => {
    let intervalId;
    const fetchScenarios = () => {
      api.getScenarios().then(res => {
        if (res && res.available) {
          setScenarios(res.available);
          setSelectedScenario(prev => {
            if (!prev && res.available.length > 0) return res.available[0];
            return prev;
          });
        }
        if (res && res.active && res.active.length > 0) {
          setActiveRun(res.active[0]);
        } else {
          setActiveRun(null);
        }
      }).catch(err => {
        console.error(err);
        setScenarios([]);
        setActiveRun(null);
      });
    };

    fetchScenarios();
    intervalId = setInterval(fetchScenarios, 3000);
    return () => clearInterval(intervalId);
  }, []);

  const filteredScenarios = scenarios.filter(s => 
    s.scenario.toLowerCase().includes(query.toLowerCase()) || 
    s.description.toLowerCase().includes(query.toLowerCase())
  );

  const startSimulation = async () => {
    if (!selectedScenario) return;
    try {
      const res = await api.startScenario({ scenario: selectedScenario.scenario });
      setActiveRun(res);
      toast.success(`Simulation started for ${selectedScenario.scenario}`);
    } catch (e) {
      toast.error(`Failed to start: ${e.message}`);
    }
  };

  const stopSimulation = async () => {
    if (!activeRun) return;
    try {
      await api.stopScenario(activeRun.scenarioId);
      setActiveRun(null);
      toast.success(`Simulation stopped`);
    } catch (e) {
      toast.error(`Failed to stop: ${e.message}`);
    }
  };

  return (
    <div style={{display: 'flex', gap: '24px', height: '100%', overflow: 'hidden'}}>
      {/* Left Pane - List */}
      <div style={{
        width: '320px', 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '16px',
        borderRight: '1px solid var(--border)',
        paddingRight: '16px',
        overflowY: 'auto',
        paddingBottom: '24px'
      }}>
        <div>
          <h2 className="agro-section-title" style={{fontSize: '20px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px'}}>
            <Activity size={20} color="var(--primary-green)"/>
            Scenario Lab
          </h2>
        </div>

        <div style={{display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px'}}>
          {filteredScenarios.map((s) => {
            const isActive = selectedScenario?.scenario === s.scenario;
            const isRunning = activeRun?.scenario === s.scenario;
            return (
              <motion.div
                key={s.scenario}
                whileHover={{ scale: 0.98 }}
                onClick={() => setSelectedScenario(s)}
                style={{
                  background: isActive ? 'var(--bg-panel-elevated)' : 'transparent',
                  border: `1px solid ${isActive ? 'var(--border)' : 'transparent'}`,
                  borderRadius: '12px',
                  padding: '12px 16px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  position: 'relative'
                }}
              >
                <div style={{
                  width: '40px', height: '40px', borderRadius: '10px', 
                  background: isActive ? 'var(--fill-light)' : 'rgba(255,255,255,0.02)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '1px solid var(--border)'
                }}>
                  {getScenarioIcon(s.scenario, s.groundTruth)}
                </div>
                <div style={{flex: 1, overflow: 'hidden'}}>
                  <div style={{fontSize: '14px', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
                    {s.scenario.toUpperCase().replace(/_/g, ' ')}
                  </div>
                </div>
                {isRunning && (
                  <motion.div 
                    animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    style={{width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary-green)', boxShadow: '0 0 8px var(--primary-green)'}}
                  />
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Right Pane - Detail */}
      <div style={{flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', paddingBottom: '24px'}}>
        <AnimatePresence mode="wait">
          {selectedScenario ? (
            <motion.div
              key={selectedScenario.scenario}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              style={{display: 'flex', flexDirection: 'column', gap: '32px', maxWidth: '800px'}}
            >
              
              <div style={{display: 'flex', alignItems: 'flex-start', gap: '24px'}}>
                <div style={{
                  width: '80px', height: '80px', borderRadius: '24px', 
                  background: 'var(--bg-panel-elevated)', border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
                }}>
                  {getScenarioIcon(selectedScenario.scenario, selectedScenario.groundTruth)}
                </div>
                <div style={{flex: 1}}>
                  <div style={{fontSize: '12px', fontWeight: 600, color: 'var(--primary-blue)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px'}}>
                    {selectedScenario.groundTruth.replace(/_/g, ' ')}
                  </div>
                  <h1 style={{fontSize: '32px', fontWeight: 700, margin: '0 0 12px 0', color: 'var(--text-main)', letterSpacing: '-0.5px'}}>
                    {selectedScenario.scenario.replace(/_/g, ' ')}
                  </h1>
                </div>
              </div>

              <div style={{background: 'var(--bg-panel-elevated)', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px'}}>
                <div style={{fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600}}>Scenario Description</div>
                <div style={{fontSize: '16px', color: 'var(--text-main)', lineHeight: '1.5'}}>{selectedScenario.description}</div>
              </div>

              <div style={{
                background: activeRun && activeRun.scenario === selectedScenario.scenario ? 'rgba(0, 229, 255, 0.05)' : 'var(--bg-panel-elevated)', 
                border: `1px solid ${activeRun && activeRun.scenario === selectedScenario.scenario ? 'var(--primary-blue)' : 'var(--border)'}`, 
                borderRadius: '24px', 
                padding: '32px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '24px',
                position: 'relative',
                overflow: 'hidden'
              }}>
                
                <motion.button 
                  whileTap={{ scale: 0.95 }}
                  whileHover={{ scale: 1.05 }}
                  onClick={activeRun ? stopSimulation : startSimulation}
                  style={{
                    background: activeRun ? 'var(--accent-red)' : 'var(--primary-blue)',
                    color: '#fff',
                    border: 'none',
                    padding: '16px 48px',
                    borderRadius: '999px',
                    fontSize: '16px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    boxShadow: `0 8px 32px ${activeRun ? 'rgba(244, 63, 94, 0.3)' : 'rgba(0, 229, 255, 0.2)'}`,
                    transition: 'background 0.3s'
                  }}
                >
                  {activeRun ? <Square size={18}/> : <Play size={18}/>}
                  {activeRun ? 'Stop Simulation' : 'Execute Scenario'}
                </motion.button>

                <AnimatePresence>
                  {activeRun && activeRun.scenario === selectedScenario.scenario && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, height: 0 }}
                      animate={{ opacity: 1, y: 0, height: 'auto' }}
                      exit={{ opacity: 0, y: -10, height: 0 }}
                      style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', marginTop: '16px' }}
                    >
                      <div style={{width: '100%', maxWidth: '400px', height: '4px', background: 'var(--fill-light)', borderRadius: '2px', overflow: 'hidden'}}>
                        {(() => {
                          const elapsedMs = Date.now() - new Date(activeRun.startedAt).getTime();
                          const durationMs = (activeRun.durationSeconds || 120) * 1000;
                          const startPercent = Math.min(100, Math.max(0, (elapsedMs / durationMs) * 100));
                          const remainingSeconds = Math.max(0, (durationMs - elapsedMs) / 1000);
                          return (
                            <motion.div 
                              style={{height: '100%', background: 'var(--primary-blue)'}}
                              initial={{ width: `${startPercent}%` }}
                              animate={{ width: '100%' }}
                              transition={{ duration: remainingSeconds, ease: "linear" }}
                            />
                          );
                        })()}
                      </div>
                      <div style={{display: 'flex', gap: '32px', fontFamily: 'monospace', fontSize: '12px', color: 'var(--text-secondary)'}}>
                        <div style={{display: 'flex', alignItems: 'center', gap: '6px'}}>
                          <motion.div 
                            animate={{ opacity: [0.3, 1, 0.3] }}
                            transition={{ repeat: Infinity, duration: 1.5 }}
                            style={{width: '6px', height: '6px', borderRadius: '50%', background: 'var(--primary-green)'}}
                          />
                          STREAMING DATA
                        </div>
                        <div>ID: {activeRun.scenarioId}</div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div style={{padding: '24px', background: 'rgba(244, 63, 94, 0.05)', border: '1px solid rgba(244, 63, 94, 0.2)', borderRadius: '16px', display: 'flex', gap: '16px'}}>
                <ShieldAlert size={24} color="var(--accent-red)" style={{flexShrink: 0}} />
                <div>
                  <h4 style={{margin: '0 0 4px 0', color: 'var(--accent-red)', fontSize: '14px', fontWeight: 600}}>System Impact</h4>
                  <p style={{margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5'}}>
                    Executing this scenario forces anomalies into the live telemetry stream. 
                    The Veracity Engine will intercept these signals, downgrade trust, and automatically generate incidents in the ledger. Downstream actions may be blocked.
                  </p>
                </div>
              </div>

            </motion.div>
          ) : (
            <div style={{flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)'}}>
              Select a scenario to view details
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
