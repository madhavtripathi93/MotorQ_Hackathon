import React, { useState, useEffect, useMemo, useRef } from 'react';
import { api, createSocketConnection } from './api/client';
import { Shield, Search, User, Bell, ChevronDown, Activity, AlertTriangle, Car, Network, Sun, Moon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Toaster, toast } from 'sonner';
import Overview from './components/Overview';
import Vehicles from './components/Vehicles';
import Incidents from './components/Incidents';
import Contracts from './components/Contracts';
import Scenarios from './components/Scenarios';
import Login from './components/Login';

const PAGE_META = {
  fleet: { title: 'Fleet', icon: Car },
  incidents: { title: 'Incidents', icon: AlertTriangle },
  contracts: { title: 'Contracts', icon: Shield },
  scenarios: { title: 'Scenarios', icon: Network }
};

export default function App() {
  const [activeTab, setActiveTab] = useState(() => {
    const hash = window.location.hash.replace('#', '');
    return ['fleet', 'incidents', 'contracts', 'scenarios', 'vehicle_details'].includes(hash) ? hash : 'fleet';
  });

  useEffect(() => {
    window.location.hash = activeTab;
  }, [activeTab]);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (['fleet', 'incidents', 'contracts', 'scenarios', 'vehicle_details'].includes(hash)) {
        setActiveTab(hash);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);
  const [query, setQuery] = useState('');
  const [vehicles, setVehicles] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [activePanel, setActivePanel] = useState('none');
  const [isLightMode, setIsLightMode] = useState(() => {
    const saved = localStorage.getItem('vista_theme');
    return saved === 'light';
  });
  const [isAuthenticated, setIsAuthenticated] = useState(!!api.token);
  const [systemHealth, setSystemHealth] = useState({
    api: 'connecting',
    kafka: 'connecting',
    clickhouse: 'connecting'
  });
  const searchRef = useRef(null);

  useEffect(() => {
    document.body.setAttribute('data-theme', isLightMode ? 'light' : 'dark');
    localStorage.setItem('vista_theme', isLightMode ? 'light' : 'dark');
  }, [isLightMode]);

  useEffect(() => {
    if (!isAuthenticated) return;
    
    let intervalId;
    api.getVehicles({ limit: 400 }).then(res => setVehicles(prev => {
      const newVehicles = res.data || [];
      return newVehicles.map(nv => {
        const existing = prev.find(pv => pv.vin === nv.vin);
        return existing ? { ...nv, trust_score: existing.trust_score } : nv;
      });
    })).catch(console.error);
    
    const fetchDashboardData = () => {
      api.getMetrics().then(res => setMetrics(prev => JSON.stringify(prev) === JSON.stringify(res) ? prev : res)).catch(() => setMetrics(null));
      api.getIncidents({ limit: 1000 }).then(res => setIncidents(prev => {
        const newData = res.data || [];
        return JSON.stringify(prev) === JSON.stringify(newData) ? prev : newData;
      })).catch(() => setIncidents([]));
      
      api.getHealth().then(res => {
        setSystemHealth({
          api: res.status === 'ready' || res.status === 'degraded' ? 'healthy' : 'down',
          kafka: ['connected', 'in-memory-fallback'].includes(res.checks?.kafka) ? 'healthy' : 'down',
          clickhouse: ['connected', 'buffer-fallback'].includes(res.checks?.clickhouse) ? 'healthy' : 'down'
        });
      }).catch(() => {
        setSystemHealth({ api: 'down', kafka: 'down', clickhouse: 'down' });
        setVehicles([]);
        setMetrics(null);
        setIncidents([]);
      });
    };

    fetchDashboardData();
    intervalId = setInterval(fetchDashboardData, 3000);

    const socket = createSocketConnection();
    let trustUpdates = {};
    let trustUpdateTimer = null;
    
    const handleTrustEvent = (data) => {
      // Map backend 'trust' field to frontend 'trust_score' expected format
      const trustVal = data.trust !== undefined ? data.trust : data.trust_score;
      trustUpdates[data.vin] = trustVal;
      
      if (!trustUpdateTimer) {
        trustUpdateTimer = setTimeout(() => {
          setVehicles(prev => {
            let changed = false;
            const next = prev.map(v => {
              if (trustUpdates[v.vin] !== undefined && v.trust_score !== trustUpdates[v.vin]) {
                changed = true;
                return { ...v, trust_score: trustUpdates[v.vin] };
              }
              return v;
            });
            trustUpdates = {};
            trustUpdateTimer = null;
            return changed ? next : prev;
          });
        }, 500); // Batch updates every 500ms
      }
    };

    socket.on('trust.updated', handleTrustEvent);
    socket.on('trust.quarantined', handleTrustEvent);
    let incidentUpdates = [];
    let incidentUpdateTimer = null;

    socket.on('incident.created', (data) => {
      if (data && data.incidentId) {
        const newIncident = {
          id: data.incidentId,
          vin: data.vin,
          signal_name: data.signal,
          status: 'OPEN',
          severity: data.severity,
          cause_attribution: data.cause,
          trust_score: data.trustScore,
          created_at: data.timestamp
        };
        
        incidentUpdates.push(newIncident);

        if (!incidentUpdateTimer) {
          incidentUpdateTimer = setTimeout(() => {
            setIncidents(prev => {
              const added = [];
              const next = [...prev];
              incidentUpdates.forEach(inc => {
                if (!next.find(i => i.id === inc.id)) {
                  next.unshift(inc);
                  added.push(inc);
                }
              });
              incidentUpdates = [];
              incidentUpdateTimer = null;
              
              if (added.length === 1) {
                toast.error(`New incident detected on ${added[0].vin}`, { description: added[0].signal_name });
              } else if (added.length > 1) {
                toast.error(`${added.length} new incidents detected!`, { description: 'Multiple anomalies detected across the fleet.' });
              }
              
              return added.length > 0 ? next : prev;
            });
          }, 500);
        }
      }
    });

    socket.on('incident.attributed', (data) => {
       // Optional: update specific incident if we want
       api.getIncidents({ limit: 1000 }).then(res => setIncidents(res.data || [])).catch(() => setIncidents([]));
    });
    
    return () => {
      if (intervalId) clearInterval(intervalId);
      socket.disconnect();
    };
  }, [isAuthenticated]);

  const visibleVehicles = useMemo(() => {
    if (!query) return vehicles;
    const lower = query.toLowerCase();
    return vehicles.filter(v => v.vin.toLowerCase().includes(lower) || v.model?.toLowerCase().includes(lower));
  }, [vehicles, query]);

  const selectVehicle = (v) => {
    setSelectedVehicle(v);
    setActiveTab('vehicle_details');
  };

  if (!isAuthenticated) {
    return <Login onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="app-viewport">
      <Toaster theme={isLightMode ? 'light' : 'dark'} position="top-right" toastOptions={{ style: { background: 'var(--bg-panel-elevated)', border: '1px solid var(--border)', color: 'var(--text-main)' } }} />
      {/* Dynamic tech-grid background instead of farm */}
      <div className="app-bg-overlay" style={{ background: 'var(--bg-map)', backgroundImage: 'radial-gradient(circle at 50% 50%, var(--fill-light) 0%, var(--bg-map) 100%)' }}></div>
      <div className="agro-dashboard-frame">
        <header className="agro-topnav">
          <div className="agro-brand" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <motion.div 
                className="agro-brand-logo" 
                style={{ position: 'relative', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
              >
                <div style={{ width: '14px', height: '14px', background: 'var(--logo-gradient)', borderRadius: '4px', transform: 'rotate(45deg)' }}/>
              </motion.div>
              <div className="agro-brand-text">
                <h1 style={{ background: 'var(--logo-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontWeight: 800, letterSpacing: '1.5px', margin: 0, textShadow: '0 0 20px rgba(0, 229, 255, 0.4)' }}>VISTA</h1>
              </div>
            </div>
            
            <div style={{display:'flex', alignItems:'center', gap:'16px', background: 'var(--fill-light)', padding: '6px 12px', borderRadius: '999px', border: '1px solid var(--border)'}}>
              <div style={{display:'flex', alignItems:'center', gap:'6px', fontSize:'11px', fontWeight:600, color:'var(--text-secondary)'}}>
                <div style={{width:'6px', height:'6px', borderRadius:'50%', background: systemHealth.api === 'healthy' ? 'var(--primary-blue)' : 'var(--accent-red)', boxShadow:`0 0 8px ${systemHealth.api === 'healthy' ? 'var(--primary-blue)' : 'var(--accent-red)'}`}}/> API
              </div>
              <div style={{display:'flex', alignItems:'center', gap:'6px', fontSize:'11px', fontWeight:600, color:'var(--text-secondary)'}}>
                <div style={{width:'6px', height:'6px', borderRadius:'50%', background: systemHealth.kafka === 'healthy' ? 'var(--primary-blue)' : 'var(--accent-red)', boxShadow:`0 0 8px ${systemHealth.kafka === 'healthy' ? 'var(--primary-blue)' : 'var(--accent-red)'}`}}/> KAFKA
              </div>
              <div style={{display:'flex', alignItems:'center', gap:'6px', fontSize:'11px', fontWeight:600, color:'var(--text-secondary)'}}>
                <div style={{width:'6px', height:'6px', borderRadius:'50%', background: systemHealth.clickhouse === 'healthy' ? 'var(--primary-blue)' : 'var(--accent-red)', boxShadow:`0 0 8px ${systemHealth.clickhouse === 'healthy' ? 'var(--primary-blue)' : 'var(--accent-red)'}`}}/> ANALYTICS
              </div>
              <div style={{display:'flex', alignItems:'center', gap:'6px', fontSize:'11px', fontWeight:600, color: systemHealth.api === 'healthy' ? 'var(--primary-green)' : 'var(--accent-red)'}}>
                <Activity size={12}/> LIVE
              </div>
            </div>
          </div>
          <nav className="agro-nav-tabs">
            {['fleet', 'incidents', 'contracts', 'scenarios'].map((tab) => (
              <button
                key={tab}
                className={`agro-nav-tab ${activeTab === tab ? 'is-active' : ''}`}
                onClick={() => { setActiveTab(tab); setSelectedVehicle(null); setQuery(''); }}
                style={{ position: 'relative' }}
              >
                {activeTab === tab && (
                  <motion.div
                    layoutId="active-tab"
                    className="agro-tab-indicator"
                    style={{ inset: 4 }}
                    transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
                  />
                )}
                <span style={{ position: 'relative', zIndex: 2 }}>{PAGE_META[tab].title}</span>
              </button>
            ))}
          </nav>
          <div className="agro-nav-right" style={{ flex: 1, position: 'relative' }}>
            <div style={{ position: 'absolute', right: 0, top: -24, zIndex: 300 }}>
              <motion.div 
                layout
                transition={{ type: "spring", stiffness: 400, damping: 35 }}
                style={{
                  display: 'flex',
                  flexDirection: activePanel !== 'none' ? 'column' : 'row',
                  alignItems: activePanel !== 'none' ? 'stretch' : 'center',
                  gap: activePanel !== 'none' ? 0 : '16px',
                  background: activePanel !== 'none' ? 'var(--bg-popover)' : 'var(--fill-light)',
                  borderRadius: activePanel !== 'none' ? '24px' : '999px',
                  border: activePanel !== 'none' ? '1px solid var(--border-strong)' : '1px solid var(--border)',
                  boxShadow: activePanel !== 'none' ? 'var(--shadow-lg)' : 'none',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  overflow: 'hidden',
                  width: activePanel === 'notifications' ? '380px' : activePanel === 'profile' ? '240px' : 'auto',
                  padding: activePanel !== 'none' ? '16px' : '6px 16px',
                  transformOrigin: 'center right'
                }}
              >
              <AnimatePresence mode="wait">
                {activePanel === 'none' ? (
                  <motion.div 
                    key="icons"
                    initial={{ opacity: 0, filter: 'blur(4px)', scale: 0.95 }}
                    animate={{ opacity: 1, filter: 'blur(0px)', scale: 1 }}
                    exit={{ opacity: 0, filter: 'blur(4px)', scale: 0.95 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    style={{ display: 'flex', alignItems: 'center', gap: '16px' }}
                  >
                    <div className="agro-search">
                      <Search size={14}/>
                      <input 
                        ref={searchRef}
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Search VIN or model..."
                      />
                    </div>
                    
                    <button className="agro-icon-btn" onClick={() => setIsLightMode(!isLightMode)}>
                      {isLightMode ? <Moon size={16}/> : <Sun size={16}/>}
                    </button>
                    
                    <button className="agro-icon-btn" onClick={() => setActivePanel('notifications')}>
                      <Bell size={16}/>
                    </button>

                    <button className="agro-icon-btn" onClick={() => setActivePanel('profile')}>
                      <User size={16}/>
                    </button>
                  </motion.div>
                ) : activePanel === 'notifications' ? (
                  <motion.div 
                    key="notifications"
                    initial={{ opacity: 0, filter: 'blur(4px)', scale: 0.98 }}
                    animate={{ opacity: 1, filter: 'blur(0px)', scale: 1 }}
                    exit={{ opacity: 0, filter: 'blur(4px)', scale: 0.98 }}
                    transition={{ duration: 0.2, delay: 0.05, ease: "easeOut" }}
                    style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
                      <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-main)' }}>System Notifications</span>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', color: 'var(--primary-green)', cursor: 'pointer' }} onClick={() => toast.success('All marked as read')}>Mark all read</span>
                        <div onClick={() => setActivePanel('none')} style={{ cursor: 'pointer', color: 'var(--text-secondary)', background: 'var(--fill-light)', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          ×
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ padding: '12px', background: 'var(--fill-light)', borderRadius: '12px', borderLeft: '3px solid var(--accent-yellow)' }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>Range Recalibration Rejected</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>VIN-8829 trust score (0.4) below VISTA threshold. Action blocked.</div>
                      </div>
                      <div style={{ padding: '12px', background: 'var(--fill-light)', borderRadius: '12px', borderLeft: '3px solid var(--primary-green)' }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>OTA Fleet Campaign Verified</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>1,402 vehicles cryptographically cleared for update.</div>
                      </div>
                    </div>
                  </motion.div>
                ) : activePanel === 'profile' ? (
                  <motion.div 
                    key="profile"
                    initial={{ opacity: 0, filter: 'blur(4px)', scale: 0.98 }}
                    animate={{ opacity: 1, filter: 'blur(0px)', scale: 1 }}
                    exit={{ opacity: 0, filter: 'blur(4px)', scale: 0.98 }}
                    transition={{ duration: 0.2, delay: 0.05, ease: "easeOut" }}
                    style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
                      <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-main)' }}>operator-001</span>
                      <div onClick={() => setActivePanel('none')} style={{ cursor: 'pointer', color: 'var(--text-secondary)', background: 'var(--fill-light)', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        ×
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <button className="agro-menu-item" style={{ padding: '10px 12px', textAlign: 'left', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '13px', borderRadius: '8px' }} onClick={() => { toast.error('Settings locked by VISTA policy'); setActivePanel('none'); }}>Settings</button>
                      <button className="agro-menu-item" style={{ padding: '10px 12px', textAlign: 'left', background: 'transparent', border: 'none', color: 'var(--accent-red)', cursor: 'pointer', fontSize: '13px', borderRadius: '8px' }} onClick={() => { 
                        api.setToken(null); 
                        setIsAuthenticated(false); 
                        setActivePanel('none'); 
                        toast.success('Logged out securely');
                      }}>Logout</button>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </motion.div>
            </div>
          </div>
        </header>

        <div className="agro-content">
          <div style={{ position: 'absolute', inset: '24px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: activeTab === 'fleet' ? 'block' : 'none', height: '100%', flex: 1 }}>
              <Overview metrics={metrics} vehicles={visibleVehicles} incidents={incidents} query={query} onSelectVehicle={selectVehicle} systemHealth={systemHealth} />
            </div>
            <div style={{ display: activeTab === 'vehicle_details' ? 'block' : 'none', height: '100%', flex: 1 }}>
              <Vehicles vehicles={visibleVehicles} selectedVehicle={selectedVehicle} onSelectVehicle={selectVehicle} onBack={() => setActiveTab('fleet')} />
            </div>
            <div style={{ display: activeTab === 'incidents' ? 'block' : 'none', height: '100%', flex: 1 }}>
              <Incidents query={query} incidents={incidents} onIncidentUpdate={(id, status) => {
                setIncidents(prev => prev.map(inc => inc.id === id ? { ...inc, status } : inc));
              }} />
            </div>
            <div style={{ display: activeTab === 'contracts' ? 'block' : 'none', height: '100%', flex: 1 }}>
              <Contracts query={query} />
            </div>
            <div style={{ display: activeTab === 'scenarios' ? 'block' : 'none', height: '100%', flex: 1 }}>
              <Scenarios query={query} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
