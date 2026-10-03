import { io } from 'socket.io-client';

const API_BASE = '/api/v1';

class ApiClient {
  constructor() {
    this.token = localStorage.getItem('vista_jwt') || null;
  }

  setToken(token) {
    this.token = token || null;
    if (token) localStorage.setItem('vista_jwt', token);
    else localStorage.removeItem('vista_jwt');
  }

  async fetch(url, options = {}) {
    const headers = {
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      ...(options.headers || {}),
    };
    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
      let payload = null;
      try { payload = await response.json(); } catch {}
      const error = new Error(payload?.message || response.statusText || 'Request failed');
      error.status = response.status;
      error.data = payload;
      throw error;
    }
    if (response.status === 204) return null;
    return response.json();
  }

  async login(sub, apiKey) {
    if (!sub || !apiKey) {
      throw new Error('Operator credentials are not configured.');
    }
    const data = await this.fetch(`${API_BASE}/auth/token`, {
      method: 'POST',
      body: JSON.stringify({ sub, apiKey }),
    });
    if (data?.token) this.setToken(data.token);
    return data;
  }
  
  async register(sub, password, name) {
    const data = await this.fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      body: JSON.stringify({ sub, password, name }),
    });
    if (data?.token) this.setToken(data.token);
    return data;
  }

  async getVehicles(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.fetch(`${API_BASE}/vehicles${query ? `?${query}` : ''}`);
  }
  async getVehicleTrust(vin, signal = 'battery_soc') {
    return this.fetch(`${API_BASE}/vehicles/${encodeURIComponent(vin)}/trust?signal=${encodeURIComponent(signal)}`);
  }
  async getIncidents(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.fetch(`${API_BASE}/incidents${query ? `?${query}` : ''}`);
  }
  async getIncidentEvidence(id) {
    return this.fetch(`${API_BASE}/incidents/${encodeURIComponent(id)}/evidence`);
  }
  async acknowledgeIncident(id) {
    return this.fetch(`${API_BASE}/incidents/${encodeURIComponent(id)}/acknowledge`, { method: 'POST' });
  }
  async getContracts(signal = null) {
    if (signal) {
      return this.fetch(`${API_BASE}/signals/${encodeURIComponent(signal)}/contracts`);
    }
    return this.fetch(`${API_BASE}/contracts`);
  }
  async activateContract(id) {
    return this.fetch(`${API_BASE}/contracts/${encodeURIComponent(id)}/activate`, { method: 'POST' });
  }
  async evaluateDecision(payload) {
    return this.fetch(`${API_BASE}/decisions/evaluate`, { method: 'POST', body: JSON.stringify(payload) });
  }
  async getScenarios() {
    return this.fetch(`${API_BASE}/scenarios`);
  }
  async startScenario(payload) {
    return this.fetch(`${API_BASE}/scenarios/start`, { method: 'POST', body: JSON.stringify(payload) });
  }
  async stopScenario(scenarioId) {
    return this.fetch(`${API_BASE}/scenarios/stop`, { method: 'POST', body: JSON.stringify({ scenarioId }) });
  }
  async getMetrics() {
    return this.fetch(`${API_BASE}/metrics/veracity`);
  }
  async getHealth() {
    return this.fetch(`/health/ready`); // Note: Health probe is mounted at root, not API_BASE
  }
}

export const api = new ApiClient();

export function createSocketConnection() {
  return io('/', { auth: { token: api.token }, transports: ['websocket', 'polling'] });
}
