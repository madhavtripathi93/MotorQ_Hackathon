import { io } from 'socket.io-client';

const API_BASE = '/api/v1';

class ApiClient {
  constructor() {
    this.token = localStorage.getItem('vista_jwt') || null;
  }

  setToken(token) {
    this.token = token;
    if (token) localStorage.setItem('vista_jwt', token);
    else localStorage.removeItem('vista_jwt');
  }

  async fetch(url, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      ...options.headers,
    };

    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
      let errorData;
      try {
        errorData = await res.json();
      } catch (e) {
        errorData = { message: res.statusText };
      }
      const err = new Error(errorData.message || 'Request failed');
      err.status = res.status;
      err.data = errorData;
      throw err;
    }
    return await res.json();
  }

  // Authentication (demo credentials configurable via environment)
  async login(
    sub = (import.meta.env.VITE_DEMO_OPERATOR_SUB || 'operator-001'),
    apiKey = (import.meta.env.VITE_DEMO_OPERATOR_KEY || 'vista-op-key-8492')
  ) {
    const data = await this.fetch(`${API_BASE}/auth/token`, {
      method: 'POST',
      body: JSON.stringify({ sub, apiKey }),
    });
    if (data && data.token) {
      this.setToken(data.token);
    }
    return data;
  }

  // Vehicles
  async getVehicles(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.fetch(`${API_BASE}/vehicles${query ? '?' + query : ''}`);
  }

  async getVehicleTrust(vin, signal = 'battery_soc') {
    return this.fetch(`${API_BASE}/vehicles/${vin}/trust?signal=${signal}`);
  }

  // Incidents
  async getIncidents(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.fetch(`${API_BASE}/incidents${query ? '?' + query : ''}`);
  }

  async getIncidentEvidence(incidentId) {
    return this.fetch(`${API_BASE}/incidents/${incidentId}/evidence`);
  }

  // Contracts
  async getContracts(signal = 'battery_soc') {
    return this.fetch(`${API_BASE}/signals/${signal}/contracts`);
  }

  async activateContract(contractId) {
    return this.fetch(`${API_BASE}/contracts/${contractId}/activate`, { method: 'POST' });
  }

  // Decisions
  async evaluateDecision(payload) {
    return this.fetch(`${API_BASE}/decisions/evaluate`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // Scenarios
  async getScenarios() {
    return this.fetch(`${API_BASE}/scenarios`);
  }

  async startScenario(payload) {
    return this.fetch(`${API_BASE}/scenarios/start`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async stopScenario(scenarioId) {
    return this.fetch(`${API_BASE}/scenarios/stop`, {
      method: 'POST',
      body: JSON.stringify({ scenarioId }),
    });
  }

  // Metrics
  async getMetrics() {
    return this.fetch(`${API_BASE}/metrics/veracity`);
  }
}

export const api = new ApiClient();

export function createSocketConnection() {
  const socket = io('/', {
    auth: { token: api.token },
    transports: ['websocket', 'polling'],
  });
  return socket;
}
