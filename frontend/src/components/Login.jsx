import React, { useState } from 'react';
import { api } from '../api/client';
import { toast } from 'sonner';
import { Lock, User, Key, Server } from 'lucide-react';

export default function Login({ onLoginSuccess }) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [sub, setSub] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!sub || !password) {
      toast.error('Username and password are required');
      return;
    }
    
    setLoading(true);
    try {
      if (isRegistering) {
        if (!name) { toast.error('Name is required'); setLoading(false); return; }
        const res = await api.register(sub, password, name);
        toast.success(`Account created, welcome ${res.user.name}`);
        if (onLoginSuccess) onLoginSuccess(res.user);
      } else {
        const res = await api.login(sub, password);
        toast.success(`Welcome back, ${res.user.name}`);
        if (onLoginSuccess) onLoginSuccess(res.user);
      }
    } catch (err) {
      toast.error(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', width: '100vw', position: 'fixed', inset: 0, background: 'var(--bg-main)' }}>
      <div className="agro-bg-overlay" style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle at 50% 50%, var(--fill-light) 0%, var(--bg-map) 100%)', opacity: 0.8 }} />
      
      <div style={{ position: 'relative', zIndex: 10, width: '400px', background: 'var(--bg-panel-elevated)', borderRadius: '24px', padding: '40px', border: '1px solid var(--border)', boxShadow: 'var(--glossy-outer), 0 20px 40px rgba(0,0,0,0.4)', backdropFilter: 'blur(20px)' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, var(--primary-blue), var(--accent-purple))', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0, 112, 243, 0.4)' }}>
            <Server size={24} color="#fff" />
          </div>
        </div>
        
        <h2 style={{ margin: '0 0 8px 0', fontSize: '24px', fontWeight: 600, color: 'var(--text-main)', textAlign: 'center', letterSpacing: '-0.5px' }}>
          {isRegistering ? 'Create VISTA Account' : 'VISTA Portal'}
        </h2>
        <p style={{ margin: '0 0 32px 0', fontSize: '14px', color: 'var(--text-secondary)', textAlign: 'center' }}>
          {isRegistering ? 'Register to manage telemetry.' : 'Sign in to access your telemetry and incidents.'}
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {isRegistering && (
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Full Name
              </label>
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--text-muted)' }}>
                  <User size={18} />
                </div>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. John Doe"
                  style={{
                    width: '100%',
                    background: 'var(--fill-light)',
                    border: '1px solid var(--border)',
                    borderRadius: '12px',
                    padding: '10px 12px 10px 40px',
                    color: 'var(--text-main)',
                    fontSize: '14px',
                    outline: 'none',
                    transition: 'border-color 0.2s',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>
          )}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Username / Sub
            </label>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--text-muted)' }}>
                <User size={18} />
              </div>
              <input
                type="text"
                value={sub}
                onChange={e => setSub(e.target.value)}
                placeholder="e.g. operator-001"
                style={{
                  width: '100%',
                  background: 'var(--fill-light)',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  padding: '10px 12px 10px 40px',
                  color: 'var(--text-main)',
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>
          
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Password / Key
            </label>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--text-muted)' }}>
                <Key size={18} />
              </div>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter your secure key"
                style={{
                  width: '100%',
                  background: 'var(--fill-light)',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  padding: '10px 12px 10px 40px',
                  color: 'var(--text-main)',
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: '16px',
              width: '100%',
              background: loading ? 'var(--fill-hover)' : 'linear-gradient(135deg, var(--primary-blue), var(--primary-blue-hover))',
              color: '#fff',
              border: 'none',
              borderRadius: '12px',
              padding: '12px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: loading ? 'none' : '0 4px 12px rgba(0, 112, 243, 0.3)',
              transition: 'all 0.2s'
            }}
          >
            {loading ? 'Authenticating...' : (
              <>
                <Lock size={16} /> {isRegistering ? 'Sign Up' : 'Sign In'}
              </>
            )}
          </button>
        </form>

        <div style={{ marginTop: '24px', textAlign: 'center' }}>
          <button
            onClick={() => setIsRegistering(!isRegistering)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--primary-blue)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              textDecoration: 'underline'
            }}
          >
            {isRegistering ? 'Already have an account? Sign in' : 'Need an account? Create one'}
          </button>
        </div>
      </div>
    </div>
  );
}
