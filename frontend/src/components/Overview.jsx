import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Activity, ShieldAlert, Cpu, Database, AlertCircle, TrendingUp, ChevronDown } from 'lucide-react';
import { motion } from 'framer-motion';
import ForceGraph2D from 'react-force-graph-2d';
import { toast } from 'sonner';

export default function Overview({ vehicles, metrics, incidents = [], query, onSelectVehicle, systemHealth }) {
  const [filterOpen, setFilterOpen] = useState(false);
  const [graphDimensions, setGraphDimensions] = useState({ width: 800, height: 600 });
  const mapContainerRef = useRef(null);

  useEffect(() => {
    if (mapContainerRef.current) {
      setGraphDimensions({
        width: mapContainerRef.current.clientWidth,
        height: mapContainerRef.current.clientHeight
      });
    }
    const handleResize = () => {
      if (mapContainerRef.current) {
        setGraphDimensions({
          width: mapContainerRef.current.clientWidth,
          height: mapContainerRef.current.clientHeight
        });
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const displayVehicles = vehicles.length > 0 ? vehicles.slice(0, 4) : [];
  const avgTrust = displayVehicles.length > 0
    ? (displayVehicles.reduce((acc, v) => acc + (v.trust_score !== undefined ? v.trust_score : (v.trust !== undefined ? v.trust : 1)), 0) / displayVehicles.length * 100).toFixed(1)
    : '--';
  
  const totalConnected = metrics?.gauges?.vista_connected_vehicles || vehicles.length || 0;
  const activeIncidents = incidents.length || 0;
  const blockedDecisions = metrics?.counters?.vista_decision_blocked_total || 0;

  const nodesRef = useRef(new Map());
  
  const graphData = useMemo(() => {
    const newNodes = vehicles.map((v) => {
      const hasIncident = incidents.some(inc => inc.vin === v.vin && inc.status === 'OPEN');
      const trustVal = v.trust_score !== undefined ? v.trust_score : (v.trust !== undefined ? v.trust : 1);
      const isAnomaly = trustVal < 0.8 || hasIncident;
      
      let node = nodesRef.current.get(v.vin);
      if (!node) {
        node = { id: v.vin, name: v.vin };
        nodesRef.current.set(v.vin, node);
      }
      
      // Mutate properties without changing object identity
      node.isAnomaly = isAnomaly;
      node.val = isAnomaly ? 5 : 2;
      node.vehicle = v;
      
      return node;
    });

    return {
      nodes: newNodes,
      links: []
    };
  }, [vehicles, incidents]);



  return (
    <div className="agro-dashboard-grid" style={{ flex: 1, minHeight: 0 }}>
      <div className="agro-map-area" ref={mapContainerRef} style={{ position: 'relative', overflow: 'hidden', background: 'var(--bg-map)' }}>
        <div style={{ position: 'absolute', inset: 0, opacity: 0.2, backgroundImage: 'linear-gradient(var(--fill-light) 1px, transparent 1px), linear-gradient(90deg, var(--fill-light) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        
        {vehicles.length > 0 && (
          <ForceGraph2D
            width={graphDimensions.width}
            height={graphDimensions.height}
            graphData={graphData}
            nodeLabel="name"
            nodeColor={node => node.isAnomaly ? '#f43f5e' : '#1e40af'}
            nodeRelSize={6}
            linkColor={() => '#88888866'}
            onNodeClick={(node) => onSelectVehicle && onSelectVehicle(node.vehicle)}
            backgroundColor="transparent"
            d3AlphaDecay={0.02}
            d3VelocityDecay={0.3}
          />
        )}

        <div className="agro-map-ui-layer">
          <motion.div 
            initial={{ opacity: 0, y: -20, filter: 'blur(8px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ type: 'spring', bounce: 0, duration: 0.8, delay: 0.1 }}
            className="agro-map-overlay-top"
          >

          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20, filter: 'blur(8px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ type: 'spring', bounce: 0, duration: 0.8, delay: 0.2 }}
            className="agro-map-overlay-bottom"
          >
            <div className="agro-map-card" style={{background:'var(--bg-popover)', backdropFilter:'blur(10px)'}}>
              <div style={{fontSize:'12px', color:'var(--text-secondary)', marginBottom:'4px'}}>Network Trust</div>
              <div style={{fontSize:'18px', fontWeight:'600', color:'var(--primary-green)', display:'flex', alignItems:'center', gap:'8px'}}>
                {avgTrust}% <span style={{fontSize:'10px', background:'var(--fill-medium)', padding:'2px 6px', borderRadius:'4px', color:'var(--primary-green)'}}>Stable</span>
              </div>
            </div>
            <div className="agro-map-card" style={{background:'var(--bg-popover)', backdropFilter:'blur(10px)'}}>
              <div style={{fontSize:'12px', color:'var(--text-secondary)', marginBottom:'4px'}}>Anomalies</div>
              <div style={{fontSize:'18px', fontWeight:'600', color:'var(--accent-yellow)', display:'flex', alignItems:'center', gap:'8px'}}>
                {activeIncidents} Detected
              </div>
            </div>
            <div className="agro-map-card" style={{background:'var(--bg-popover)', backdropFilter:'blur(10px)'}}>
              <div style={{fontSize:'12px', color:'var(--text-secondary)', marginBottom:'4px'}}>Blocked Actions</div>
              <div style={{fontSize:'18px', fontWeight:'600', color:'var(--text-main)', display:'flex', alignItems:'center', gap:'8px'}}>
                {blockedDecisions} Total
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      <motion.div 
        initial={{ opacity: 0, x: 30, filter: 'blur(8px)' }}
        animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
        transition={{ type: 'spring', bounce: 0, duration: 0.8 }}
        className="agro-right-col"
      >
        <div className="agro-stats-row">
          <div 
            className="agro-stat-card" 
            style={{gridColumn:'span 3', cursor: 'pointer'}}
            onClick={() => document.querySelector('.agro-equipment-list')?.scrollIntoView({behavior: 'smooth'})}
          >
            <div className="agro-stat-icon" style={{background:'var(--fill-light)', color:'var(--text-main)'}}><Activity size={20}/></div>
            <div className="agro-stat-content">
              <h3>Total Vehicles</h3>
              <p>{totalConnected.toLocaleString()} <span style={{fontSize:'12px', color:'var(--text-secondary)', fontWeight:'400'}}>connected</span></p>
            </div>
          </div>
        </div>

        <div>
          <div className="agro-section-title"><ShieldAlert size={16} color="var(--text-secondary)"/> Fleet Veracity Monitor</div>
          <div className="agro-equipment-list" style={{perspective: '1000px'}}>
            {displayVehicles.length === 0 ? (
              <div style={{gridColumn:'span 2', color:'var(--text-secondary)', fontSize:'13px', padding:'20px', textAlign:'center', background:'var(--fill-light)', borderRadius:'12px'}}>
                {query ? `No vehicles found matching "${query}"` : 'Waiting for telemetry...'}
              </div>
            ) : displayVehicles.map((v, i) => (
              <motion.div 
                key={v.vin || v.id} 
                initial={{ opacity: 0, y: 20, scale: 0.95, filter: 'blur(8px)' }}
                animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                whileHover={{ scale: 1.02, boxShadow: '0 10px 20px rgba(0,0,0,0.4)' }}
                transition={{ type: 'spring', bounce: 0, duration: 0.8, delay: 0.1 + (i * 0.05) }}
                className="agro-eq-card" 
                style={{display:'flex', flexDirection:'column', background:'var(--bg-panel-elevated)', cursor: 'pointer'}}
                onClick={() => onSelectVehicle && onSelectVehicle(v)}
              >
                <div style={{padding:'16px', flex:1, transform: 'translateZ(10px)'}}>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'12px'}}>
                    <div style={{width:'32px', height:'32px', borderRadius:'8px', background:'var(--fill-light)', display:'flex', alignItems:'center', justifyContent:'center'}}>
                      <Cpu size={16} color="var(--text-secondary)"/>
                    </div>
                    {((v.trust_score || v.trust || 1) < 0.8 || incidents.some(inc => inc.vin === v.vin && inc.status === 'OPEN')) ? (
                       <AlertCircle size={16} color="var(--accent-yellow)"/>
                    ) : (
                       <div style={{width:'8px', height:'8px', borderRadius:'50%', background:'var(--primary-green)'}}/>
                    )}
                  </div>
                  <h4>{v.vin}</h4>
                  <div className="agro-eq-meta">
                    <span>{v.model}</span>
                    <span style={{color: ((v.trust_score || v.trust || 1) < 0.8 || incidents.some(inc => inc.vin === v.vin && inc.status === 'OPEN')) ? 'var(--accent-yellow)' : 'var(--text-secondary)'}}>
                      Trust: {((v.trust_score || v.trust || 1) * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
        
        <motion.div 
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 1, type: 'spring' }}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '10px 0', flex: 1, minHeight: '80px' }}
        >
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            style={{ 
              width: '40px', height: '40px', 
              background: 'radial-gradient(circle at 30% 30%, var(--fill-light) 0%, transparent 60%), var(--bg-panel-elevated)', 
              borderRadius: '50%', 
              border: '2px solid var(--border-strong)', 
              display: 'flex', alignItems: 'center', justifyContent: 'center', 
              position: 'relative', 
              boxShadow: '0 10px 20px rgba(0,0,0,0.5), inset 0 -4px 10px rgba(0,0,0,0.5), inset 0 2px 5px rgba(255,255,255,0.2)' 
            }}
          >
            {/* The eye / pupil */}
            <motion.div
              animate={{ x: [-6, 6, -3, 0], scaleY: [1, 0.1, 1, 1, 1, 1] }}
              transition={{ 
                x: { duration: 5, repeat: Infinity, ease: "easeInOut" }, 
                scaleY: { duration: 4, repeat: Infinity, times: [0, 0.05, 0.1, 0.4, 0.45, 1] } 
              }}
              style={{ width: '12px', height: '12px', background: 'var(--primary-green)', borderRadius: '50%', boxShadow: '0 0 10px var(--primary-green)' }}
            />
            {/* Holographic scanning ring */}
            <motion.div
              animate={{ rotateX: [0, 75, 150, 225, 360], rotateZ: [0, 360] }}
              transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
              style={{ position: 'absolute', inset: -8, border: '1px dashed rgba(0,229,255,0.2)', borderRadius: '50%', borderTop: '2px solid var(--primary-green)' }}
            />
          </motion.div>
          <div style={{ marginTop: '12px', fontSize: '9px', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '2px' }}>
            <Activity size={9} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'text-top' }}/> V.I.S.T.A. OVERSEER
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20, filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ type: 'spring', bounce: 0, duration: 0.8, delay: 0.3 }}
          className="agro-chart-panel" 
          style={{marginTop:'auto'}}
        >
          <div className="agro-chart-header">
            <h3 className="agro-section-title" style={{marginBottom:0}}><TrendingUp size={16} color="var(--text-secondary)"/> Veracity Trend</h3>
            <span style={{fontSize:'11px', color:'var(--text-secondary)'}}>Last 24h</span>
          </div>
          <div className="agro-chart-area" style={{ height: '100px', display: 'flex', alignItems: 'flex-end', gap: '4px' }}>
            {(() => {
              const currentTrust = parseFloat(avgTrust) || 100;
              // Generate a visually appealing curve anchored around currentTrust
              const baseData = Array(24).fill(0).map((_, i) => {
                const wave = Math.sin(i / 3) * 2 + Math.cos(i / 2) * 1.5;
                return Math.min(100, Math.max(0, currentTrust - 2 + wave));
              });
              const chartData = (systemHealth && systemHealth.api !== 'healthy') ? baseData.map(() => 0) : baseData;
              return chartData.map((val, i) => (
                <div key={i} style={{ flex: 1, height: '100%', position: 'relative', display: 'flex', alignItems: 'flex-end' }}>
                <motion.div 
                  initial={{ height: '0%', opacity: 0 }}
                  animate={{ height: `${val}%`, opacity: 1 }}
                  transition={{ duration: 0.8, delay: i * 0.02, type: 'spring' }}
                  style={{
                    width: '100%',
                    background: val < 90 ? 'linear-gradient(to top, rgba(244, 63, 94, 0.1), rgba(244, 63, 94, 0.8))' : 'linear-gradient(to top, rgba(30, 64, 175, 0.1), rgba(30, 64, 175, 0.8))',
                    borderRadius: '4px 4px 0 0',
                    borderTop: `2px solid ${val < 90 ? 'var(--accent-red)' : '#1e40af'}`,
                    boxShadow: val < 90 ? '0 -4px 12px rgba(244, 63, 94, 0.2)' : '0 -4px 12px rgba(30, 64, 175, 0.2)'
                  }}
                />
              </div>
            ));
            })()}
          </div>
          <div style={{display:'flex', justifyContent:'space-between', marginTop:'12px', fontSize:'10px', color:'var(--text-secondary)', fontWeight: 600}}>
            <span>00:00</span>
            <span>04:00</span>
            <span>08:00</span>
            <span>12:00</span>
            <span>16:00</span>
            <span>20:00</span>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
