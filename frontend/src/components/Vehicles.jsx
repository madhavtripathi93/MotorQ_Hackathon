import React, { useState, useEffect } from 'react';
import { ChevronLeft, Shield, Activity, MapPin, Battery, Cpu, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { api } from '../api/client';

export default function Vehicles({ vehicles, selectedVehicle, onSelectVehicle, onBack }) {
  if (!selectedVehicle) return null;

  const [trustData, setTrustData] = useState(null);
  const [incidents, setIncidents] = useState([]);

  useEffect(() => {
    if (selectedVehicle?.vin) {
      api.getVehicleTrust(selectedVehicle.vin, 'battery_soc')
        .then(res => setTrustData(res.data))
        .catch(console.error);
        
      api.getIncidents({ vin: selectedVehicle.vin })
        .then(res => setIncidents(res.data || []))
        .catch(console.error);
    }
  }, [selectedVehicle]);

  const score = trustData?.trustScore !== undefined ? trustData.trustScore : (selectedVehicle.trust_score !== undefined ? selectedVehicle.trust_score : (selectedVehicle.trust !== undefined ? selectedVehicle.trust : null));
  const isHealthy = score === null || score >= 0.90;

  return (
    <div style={{display:'flex', flexDirection:'column', gap:'24px', height:'100%', overflowY: 'auto', paddingBottom: '24px'}}>
      <div style={{display:'flex', alignItems:'center', gap:'12px'}}>
        <button className="agro-icon-btn" onClick={onBack}><ChevronLeft size={20}/></button>
        <div>
          <h2 className="agro-section-title" style={{fontSize:'20px', marginBottom:'4px'}}>{selectedVehicle.vin}</h2>
          <p style={{color:'var(--text-secondary)', fontSize:'13px'}}>{selectedVehicle.model || 'Connected Vehicle'}</p>
        </div>
      </div>

      <div className="agro-dashboard-grid" style={{gridTemplateColumns:'300px 1fr'}}>
        {/* Left Col - Identity */}
        <div style={{display:'flex', flexDirection:'column', gap:'20px'}}>
          <div style={{background:'var(--bg-panel-elevated)', borderRadius:'12px', border:'1px solid var(--border)', padding:'24px', display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center'}}>
             <div style={{width:'80px', height:'80px', borderRadius:'16px', background:'var(--bg-panel)', border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:'16px'}}>
               <Shield size={40} color={isHealthy ? 'var(--primary-green)' : '#f43f5e'} />
             </div>
             <h3 style={{fontSize:'18px', fontWeight:'600'}}>{score !== null ? `${(score * 100).toFixed(1)}%` : '--%'}</h3>
             <p style={{color:'var(--text-secondary)', fontSize:'13px'}}>Current Trust Score</p>
             
             <div style={{marginTop:'24px', width:'100%', display:'flex', flexDirection:'column', gap:'12px', textAlign:'left'}}>
               <div style={{display:'flex', justifyContent:'space-between', fontSize:'13px'}}>
                 <span style={{color:'var(--text-secondary)'}}>Status</span>
                 <span style={{color: isHealthy ? 'var(--primary-green)' : '#f43f5e'}}>{isHealthy ? 'TRUSTED' : 'DEGRADED'}</span>
               </div>
               <div style={{display:'flex', justifyContent:'space-between', fontSize:'13px'}}>
                 <span style={{color:'var(--text-secondary)'}}>Firmware</span>
                 <span style={{fontFamily:'monospace'}}>{selectedVehicle.firmware_version || 'Unknown'}</span>
               </div>
               <div style={{display:'flex', justifyContent:'space-between', fontSize:'13px'}}>
                 <span style={{color:'var(--text-secondary)'}}>Last Heartbeat</span>
                 <span>{selectedVehicle.last_heartbeat ? new Date(selectedVehicle.last_heartbeat).toLocaleTimeString() : 'N/A'}</span>
               </div>
             </div>
          </div>
        </div>

        {/* Right Col - Telemetry & Incidents */}
        <div style={{display:'flex', flexDirection:'column', gap:'20px'}}>
          
          <h3 className="agro-section-title" style={{fontSize:'16px'}}>Live Telemetry</h3>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px'}}>
             <div style={{background:'var(--bg-panel-elevated)', borderRadius:'12px', border:'1px solid var(--border)', padding:'20px'}}>
               <div style={{display:'flex', alignItems:'center', gap:'12px', marginBottom:'16px'}}>
                 <Battery size={20} color="var(--accent-yellow)"/>
                 <h4 style={{fontWeight:'500'}}>Battery SoC</h4>
               </div>
               <div style={{fontSize:'24px', fontWeight:'600'}}>{selectedVehicle.battery_soc !== undefined ? `${selectedVehicle.battery_soc}%` : 'N/A'}</div>
             </div>
             <div style={{background:'var(--bg-panel-elevated)', borderRadius:'12px', border:'1px solid var(--border)', padding:'20px'}}>
               <div style={{display:'flex', alignItems:'center', gap:'12px', marginBottom:'16px'}}>
                 <MapPin size={20} color="var(--text-secondary)"/>
                 <h4 style={{fontWeight:'500'}}>GPS Location</h4>
               </div>
               <div style={{fontSize:'16px', fontWeight:'600', fontFamily:'monospace'}}>{selectedVehicle.gps_location || 'N/A'}</div>
             </div>
          </div>

          <h3 className="agro-section-title" style={{fontSize:'16px', marginTop:'12px'}}>Incident History</h3>
          <div style={{background:'var(--bg-panel-elevated)', borderRadius:'12px', border:'1px solid var(--border)', overflow:'hidden'}}>
             {incidents.length === 0 ? (
               <div style={{padding:'32px', textAlign:'center', color:'var(--text-secondary)', fontSize:'13px'}}>
                 <CheckCircle2 size={24} style={{margin:'0 auto 12px', opacity:0.5}} />
                 No incidents recorded for this vehicle.
               </div>
             ) : (
               <table style={{width:'100%', borderCollapse:'collapse', textAlign:'left'}}>
                <thead style={{background:'rgba(23, 36, 29, 0.4)', borderBottom:'1px solid var(--border)', fontSize:'12px', color:'var(--text-secondary)'}}>
                  <tr>
                    <th style={{padding:'12px 16px', fontWeight:'500'}}>Incident ID</th>
                    <th style={{padding:'12px 16px', fontWeight:'500'}}>Type</th>
                    <th style={{padding:'12px 16px', fontWeight:'500'}}>Status</th>
                    <th style={{padding:'12px 16px', fontWeight:'500'}}>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {incidents.map(inc => (
                    <tr key={inc.id} style={{borderBottom:'1px solid var(--border)', fontSize:'13px'}}>
                      <td style={{padding:'16px', fontWeight:'500'}}>{inc.id}</td>
                      <td style={{padding:'16px', color:'var(--text-secondary)'}}>{inc.cause_attribution || inc.signal_name}</td>
                      <td style={{padding:'16px'}}>
                        <span style={{color: inc.status === 'RESOLVED' ? '#8A963D' : '#f43f5e'}}>{inc.status}</span>
                      </td>
                      <td style={{padding:'16px', color:'var(--text-secondary)'}}>{new Date(inc.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
             )}
          </div>

          <h3 className="agro-section-title" style={{fontSize:'16px', marginTop:'12px'}}>Historical Trust Timeline</h3>
          <div style={{background:'var(--bg-panel-elevated)', borderRadius:'12px', border:'1px solid var(--border)', padding:'24px', display:'flex', flexDirection:'column', gap:'16px'}}>
            {incidents.length === 0 ? (
              <div style={{display:'flex', gap:'12px'}}>
                <div style={{display:'flex', flexDirection:'column', alignItems:'center', gap:'4px'}}>
                  <div style={{width:'10px', height:'10px', borderRadius:'50%', background:'var(--primary-green)'}}/>
                  <div style={{flex:1, width:'2px', background:'transparent'}}/>
                </div>
                <div>
                  <div style={{fontSize:'12px', color:'var(--text-secondary)'}}>Today</div>
                  <div style={{fontSize:'14px', fontWeight:500}}>Initial Baseline</div>
                  <div style={{fontSize:'13px', color:'var(--text-secondary)'}}>Trust verified. Telemetry is stable.</div>
                </div>
              </div>
            ) : (
              incidents.map((inc, index) => (
                <div key={inc.id} style={{display:'flex', gap:'12px'}}>
                  <div style={{display:'flex', flexDirection:'column', alignItems:'center', gap:'4px'}}>
                    <div style={{width:'10px', height:'10px', borderRadius:'50%', background: inc.severity === 'CRITICAL' ? '#f43f5e' : '#f59e0b'}}/>
                    <div style={{flex:1, width:'2px', background: index === incidents.length - 1 ? 'transparent' : 'var(--border)'}}/>
                  </div>
                  <div style={{paddingBottom: index === incidents.length - 1 ? '0' : '16px'}}>
                    <div style={{fontSize:'12px', color:'var(--text-secondary)'}}>{new Date(inc.created_at).toLocaleString()}</div>
                    <div style={{fontSize:'14px', fontWeight:500, color: inc.severity === 'CRITICAL' ? '#f43f5e' : '#f59e0b'}}>Anomaly Detected</div>
                    <div style={{fontSize:'13px', color:'var(--text-secondary)'}}>{inc.cause_attribution || inc.signal_name} - Trust dropped.</div>
                  </div>
                </div>
              ))
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
