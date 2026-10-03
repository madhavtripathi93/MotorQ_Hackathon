import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { Search, Filter, AlertTriangle, CheckCircle2, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Incidents({ query = '', incidents = [], onIncidentUpdate }) {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterSeverity, setFilterSeverity] = useState('ALL');

  const [selectedIncident, setSelectedIncident] = useState(null);

  const handleAcknowledge = async () => {
    if (!selectedIncident) return;
    try {
      const res = await api.acknowledgeIncident(selectedIncident.id);
      if (onIncidentUpdate) {
        onIncidentUpdate(selectedIncident.id, 'ACKNOWLEDGED');
      }
      setSelectedIncident({ ...selectedIncident, status: 'ACKNOWLEDGED' });
    } catch (err) {
      console.error('Failed to acknowledge incident:', err);
    }
  };

  const displayData = incidents.length > 0 ? incidents : [];
  
  const filtered = displayData.filter(i => {
    const matchesQuery = i.vin?.toLowerCase().includes(query.toLowerCase()) || String(i.id).toLowerCase().includes(query.toLowerCase());
    const matchesSeverity = filterSeverity === 'ALL' || i.severity === filterSeverity;
    return matchesQuery && matchesSeverity;
  });

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', overflow: 'hidden' }}>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0, width: selectedIncident ? '30%' : '100%' }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        style={{height: '100%', display:'flex', flexDirection:'column', gap:'24px', paddingRight: selectedIncident ? '24px' : '0'}}
      >
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <div>
            <h2 className="agro-section-title" style={{fontSize:'20px', marginBottom:'4px', color:'var(--text-main)'}}>Incident Response</h2>
          </div>
          <div style={{display:'flex', gap:'12px', position:'relative'}}>
            <button 
              className="agro-toolbar-btn" 
              style={{display:'flex', alignItems:'center', gap:'8px', cursor:'pointer'}}
              onClick={() => setIsFilterOpen(!isFilterOpen)}
            >
              <Filter size={14}/> {filterSeverity !== 'ALL' ? filterSeverity : 'Filter'} <ChevronDown size={14} style={{transform: isFilterOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: '0.2s'}}/>
            </button>

            <AnimatePresence>
              {isFilterOpen && (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  style={{
                    position: 'absolute', top: 'calc(100% + 8px)', right: 0, 
                    background: 'var(--bg-panel-elevated)', border: '1px solid var(--border)', 
                    borderRadius: '12px', padding: '8px', zIndex: 50,
                    boxShadow: 'var(--shadow-md)', minWidth: '150px',
                    backdropFilter: 'blur(20px)'
                  }}
                >
                  {['ALL', 'CRITICAL', 'HIGH', 'LOW'].map(sev => (
                    <div 
                      key={sev}
                      onClick={() => { setFilterSeverity(sev); setIsFilterOpen(false); }}
                      style={{
                        padding: '8px 12px', fontSize: '13px', cursor: 'pointer',
                        borderRadius: '8px', color: filterSeverity === sev ? 'var(--primary-green)' : 'var(--text-main)',
                        background: filterSeverity === sev ? 'rgba(0, 229, 255, 0.1)' : 'transparent'
                      }}
                      onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.05)'}
                      onMouseLeave={(e) => e.target.style.background = filterSeverity === sev ? 'rgba(0, 229, 255, 0.1)' : 'transparent'}
                    >
                      {sev === 'ALL' ? 'All Severities' : sev}
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div style={{background:'var(--bg-panel-elevated)', borderRadius:'12px', border:'1px solid var(--border)', overflow:'hidden', display: 'flex', flexDirection: 'column', flex: 1}}>
          {filtered.length === 0 ? (
            <div style={{padding:'48px', textAlign:'center', color:'var(--text-secondary)'}}>
               No incidents found. VISTA Veracity is stable.
            </div>
          ) : (
          <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
            <div style={{ position: 'absolute', inset: 0, overflowY: 'auto' }}>
              <table style={{width:'100%', borderCollapse:'collapse', textAlign:'left'}}>
              <thead style={{background:'rgba(255, 255, 255, 0.03)', borderBottom:'1px solid var(--border)', fontSize:'12px', color:'var(--text-secondary)'}}>
                <tr>
                  <th style={{padding:'12px 16px', fontWeight:'500'}}>Incident ID</th>
                  <th style={{padding:'12px 16px', fontWeight:'500'}}>Vehicle (VIN)</th>
                  <th style={{padding:'12px 16px', fontWeight:'500'}}>Signal / Cause</th>
                  <th style={{padding:'12px 16px', fontWeight:'500'}}>Severity</th>
                  <th style={{padding:'12px 16px', fontWeight:'500'}}>Status</th>
                  <th style={{padding:'12px 16px', fontWeight:'500'}}>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {filtered.map((inc, i) => (
                    <motion.tr 
                      key={inc.id} 
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      whileHover={{ backgroundColor: 'rgba(0, 229, 255, 0.05)' }}
                      transition={{ duration: 0.3, delay: i * 0.05 }}
                      onClick={() => setSelectedIncident(inc)}
                      style={{
                        borderBottom:'1px solid var(--border)', 
                        fontSize:'13px', 
                        cursor: 'pointer',
                        backgroundColor: selectedIncident?.id === inc.id ? 'rgba(0, 229, 255, 0.1)' : 'transparent'
                      }}
                    >
                      <td style={{padding:'16px', fontWeight:'500', color:'var(--text-main)'}} title={inc.id}>{String(inc.id).substring(0,8)}...</td>
                      <td style={{padding:'16px', color:'var(--text-secondary)'}}>{inc.vin}</td>
                      <td style={{padding:'16px', color:'var(--text-secondary)'}}>
                        <div>{inc.signal_name}</div>
                        <div style={{fontSize:'11px', color:'var(--text-muted)'}}>{inc.cause_attribution}</div>
                      </td>
                      <td style={{padding:'16px'}}>
                        <span style={{
                          color: inc.severity === 'CRITICAL' ? '#F72585' : inc.severity === 'HIGH' ? '#f59e0b' : 'var(--text-secondary)'
                        }}>
                          {inc.severity}
                        </span>
                      </td>
                      <td style={{padding:'16px'}}>
                        <span style={{
                          display:'inline-flex', alignItems:'center', gap:'4px',
                          padding:'4px 8px', borderRadius:'999px', fontSize:'11px',
                          background: inc.status === 'RESOLVED' ? 'rgba(0, 229, 255, 0.1)' : inc.status === 'OPEN' ? 'rgba(247, 37, 133, 0.1)' : 'rgba(245,158,11,0.1)',
                          color: inc.status === 'RESOLVED' ? 'var(--primary-green)' : inc.status === 'OPEN' ? 'var(--accent-yellow)' : '#f59e0b'
                        }}>
                          {inc.status === 'RESOLVED' ? <CheckCircle2 size={12}/> : <AlertTriangle size={12}/>}
                          {inc.status}
                        </span>
                      </td>
                      <td style={{padding:'16px', color:'var(--text-secondary)'}}>{new Date(inc.created_at).toLocaleString()}</td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
            </div>
          </div>
          )}
        </div>
      </motion.div>

      <AnimatePresence>
        {selectedIncident && (
          <motion.div
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            style={{
              width: '70%',
              background: 'var(--bg-panel-elevated)',
              borderLeft: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '-10px 0 30px rgba(0,0,0,0.1)',
              zIndex: 10,
              overflow: 'hidden',
              height: '100%',
              minHeight: 0
            }}
          >
            <div style={{ padding: '24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '18px', color: 'var(--text-main)', margin: '0 0 4px 0' }}>Investigation</h3>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>ID: {selectedIncident.id}</div>
              </div>
              <button 
                className="agro-icon-btn" 
                onClick={() => setSelectedIncident(null)}
                style={{ background: 'var(--fill-light)', color: 'var(--text-main)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                ×
              </button>
            </div>
            
            <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
              <div style={{ position: 'absolute', inset: 0, overflowY: 'auto' }}>
                <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Target Entity</div>
                <div style={{ padding: '12px', background: 'var(--fill-light)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '14px', color: 'var(--text-main)', fontWeight: 600 }}>{selectedIncident.vin}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>Model: {selectedIncident.vehicle?.model || 'Unknown'}</div>
                </div>
              </div>

              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>Anomaly Details</div>
                <div style={{ padding: '16px', background: 'var(--fill-light)', borderRadius: '8px', borderLeft: `3px solid ${selectedIncident.severity === 'CRITICAL' ? '#F72585' : 'var(--accent-yellow)'}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <AlertTriangle size={16} color={selectedIncident.severity === 'CRITICAL' ? '#F72585' : 'var(--accent-yellow)'} />
                    <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)' }}>{selectedIncident.signal_name}</span>
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{selectedIncident.cause_attribution || 'Unknown Cause'}</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-main)', marginTop: '8px' }}>
                    Trust Impact: {selectedIncident.trust_score !== undefined ? selectedIncident.trust_score : (selectedIncident.trust_impact !== undefined ? selectedIncident.trust_impact : 'N/A')}
                  </div>
                </div>
              </div>

              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>Downstream Harm & Impact</div>
                
                <div style={{ padding: '16px', background: 'var(--fill-light)', borderRadius: '8px', border: '1px solid var(--border)', fontSize:'13px' }}>
                  <div style={{marginBottom:'16px'}}>
                    <span style={{color: selectedIncident.severity === 'CRITICAL' ? '#F72585' : '#f59e0b', fontWeight:600}}>Affected Workflows:</span> {
                      String(selectedIncident.signal_name || '').toLowerCase().includes('soc') ? 'Dynamic Range Recalibration, Route Planning' :
                      String(selectedIncident.signal_name || '').toLowerCase().includes('firmware') ? 'OTA Update Campaign, Fleet Safety' :
                      String(selectedIncident.signal_name || '').toLowerCase().includes('gps') ? 'Geofencing, Dispatch Routing' : 'General Telemetry Intake'
                    }
                  </div>

                  <div style={{marginBottom:'16px'}}>
                    <div style={{display:'flex', justifyContent:'space-between', marginBottom:'4px'}}>
                      <span style={{color:'var(--text-secondary)'}}>System Confidence</span>
                      <span style={{color:'var(--text-main)', fontWeight:600}}>{(Number(selectedIncident.confidence ?? 0.9) * 100).toFixed(1)}%</span>
                    </div>
                    <div style={{width:'100%', height:'6px', background:'var(--bg-panel-elevated)', borderRadius:'3px', overflow:'hidden'}}>
                      <div style={{height:'100%', width:`${(Number(selectedIncident.confidence ?? 0.9) * 100)}%`, background:'#1e40af'}} />
                    </div>
                  </div>

                  <div style={{marginBottom:'8px'}}>
                    <div style={{display:'flex', justifyContent:'space-between', marginBottom:'4px'}}>
                      <span style={{color:'var(--text-secondary)'}}>Veracity (Trust Score)</span>
                      <span style={{color: Number(selectedIncident.trust_score ?? selectedIncident.trust_impact ?? 0) < 0.5 ? '#F72585' : 'var(--accent-yellow)', fontWeight:600}}>{Number(selectedIncident.trust_score ?? selectedIncident.trust_impact ?? 0).toFixed(2)}</span>
                    </div>
                    <div style={{width:'100%', height:'6px', background:'var(--bg-panel-elevated)', borderRadius:'3px', overflow:'hidden'}}>
                      <div style={{height:'100%', width:`${Number(selectedIncident.trust_score ?? selectedIncident.trust_impact ?? 0) * 100}%`, background: Number(selectedIncident.trust_score ?? selectedIncident.trust_impact ?? 0) < 0.5 ? '#F72585' : 'var(--accent-yellow)'}} />
                    </div>
                  </div>
                </div>
              </div>

              <details style={{background:'var(--fill-light)', borderRadius:'8px', border:'1px solid var(--border)', padding:'12px'}}>
                <summary style={{fontSize:'12px', color:'var(--text-secondary)', cursor:'pointer', fontWeight:600, outline:'none'}}>VIEW RAW EVIDENCE PAYLOAD (EXPAND)</summary>
                <pre style={{marginTop:'12px', fontSize:'11px', color:'var(--text-muted)', fontFamily:'monospace', overflowX:'auto'}}>
                  {JSON.stringify(selectedIncident, null, 2)}
                </pre>
              </details>


              {selectedIncident.status === 'OPEN' && (
                <button 
                  onClick={handleAcknowledge}
                  style={{
                  padding: '12px',
                  background: 'var(--primary-green)',
                  color: '#000',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  marginTop: 'auto'
                }}>
                  Acknowledge & Escalate
                </button>
              )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
