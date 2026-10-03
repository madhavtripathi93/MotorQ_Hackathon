import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { ShieldCheck, Calendar, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

export default function Contracts({ query = '' }) {
  const [contracts, setContracts] = useState([]);

  useEffect(() => {
    // API gives { contracts: [] }
    api.getContracts().then(res => {
      if (res && res.contracts) setContracts(res.contracts);
    }).catch(console.error);
  }, []);

  const displayData = contracts.filter(c => {
    if (!query) return true;
    return c.canonical_name.toLowerCase().includes(query.toLowerCase()) || 
           c.source_ecu.toLowerCase().includes(query.toLowerCase());
  });

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      style={{display:'flex', flexDirection:'column', gap:'24px', height:'100%'}}
    >
      <div>
        <h2 className="agro-section-title" style={{fontSize:'20px', marginBottom:'4px', color:'var(--text-main)'}}>Veracity Contracts</h2>
      </div>

      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:'20px', perspective: '1000px'}}>
        <AnimatePresence>
          {displayData.length === 0 ? (
            <div style={{color:'var(--text-secondary)'}}>No contracts found.</div>
          ) : displayData.map((c, i) => (
            <motion.div 
              key={c.id} 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              whileHover={{ 
                scale: 1.02, 
                boxShadow: '0 20px 40px -10px rgba(247, 37, 133, 0.2)',
                borderColor: 'rgba(247, 37, 133, 0.4)'
              }}
              transition={{ duration: 0.4, delay: i * 0.1, type: "spring", stiffness: 300 }}
              style={{
                background:'var(--bg-panel-elevated)', borderRadius:'16px', padding:'20px',
                border:'1px solid var(--border)', display:'flex', flexDirection:'column', gap:'16px'
              }}
            >
              <div style={{display:'flex', alignItems:'flex-start', gap:'12px'}}>
                <div style={{width:'40px', height:'40px', borderRadius:'10px', background:'rgba(247, 37, 133, 0.1)', color:'var(--accent-pink)', display:'flex', alignItems:'center', justifyContent:'center'}}>
                  <ShieldCheck size={20}/>
                </div>
                <div style={{flex:1}}>
                  <h3 style={{fontSize:'15px', fontWeight:'600', color:'var(--text-main)'}}>Version {c.semantic_version} ({c.canonical_name})</h3>
                  <p style={{fontSize:'12px', color:'var(--text-secondary)'}}>Signal: {c.source_ecu}</p>
                </div>
              </div>

              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', borderTop:'1px solid var(--border)', paddingTop:'16px'}}>
                <div style={{display:'flex', alignItems:'center', gap:'6px', fontSize:'12px', color:'var(--text-secondary)'}}>
                  <div style={{width:'8px', height:'8px', borderRadius:'50%', background:'var(--primary-green)'}}/>
                  ACTIVE
                </div>
                <div style={{display:'flex', flexDirection:'column', alignItems:'flex-end', gap:'2px', fontSize:'12px', color:'var(--text-main)'}}>
                  <span>Unit: {c.unit}</span>
                  <span style={{color:'var(--text-muted)'}}>Range: {c.min_value} - {c.max_value}</span>
                </div>
              </div>

              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:'auto'}}>
                <div style={{fontSize:'11px', color:'var(--text-muted)', display:'flex', alignItems:'center', gap:'4px'}}>
                  <Calendar size={12}/> {new Date(c.active_from).toLocaleDateString()}
                </div>
                <motion.button 
                  whileTap={{ scale: 0.95 }}
                  whileHover={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
                  onClick={async () => {
                    try {
                      await api.activateContract(c.id);
                      toast.success(`Contract ${c.id} activated successfully.`);
                    } catch (e) {
                      toast.error(`Failed to activate contract: ${e.message}`);
                    }
                  }}
                  style={{
                    background:'transparent', border:'1px solid var(--border)', color:'var(--text-secondary)',
                    padding:'6px 12px', borderRadius:'6px', fontSize:'12px', cursor:'pointer'
                  }}
                >
                  Activate
                </motion.button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
