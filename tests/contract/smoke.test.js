import { describe, it, expect } from 'vitest';
import http from 'http';
import { Socket } from 'net';
import appModule from '../../backend/api/src/app';

const app = appModule.default || appModule;

function dispatch(app, method, url, body = null, headers = {}) {
  return new Promise((resolve) => {
    const socket = new Socket();
    const req = new http.IncomingMessage(socket);
    req.method = method;
    req.url = url;
    req.headers = { host: 'localhost', ...headers };
    if (body) {
      const bodyStr = JSON.stringify(body);
      req.headers['content-type'] = 'application/json';
      req.headers['content-length'] = Buffer.byteLength(bodyStr);
      req.body = body;
      req._body = true;
      req.push(bodyStr);
    }
    req.push(null);

    const res = new http.ServerResponse(req);
    let resBody = '';

    res.write = function (chunk) {
      if (chunk) resBody += chunk.toString();
      return true;
    };
    res.end = function (chunk) {
      if (chunk) resBody += chunk.toString();
      let parsed = resBody;
      try {
        parsed = JSON.parse(resBody);
      } catch (e) {}
      resolve({ status: res.statusCode, body: parsed, text: resBody, headers: res.getHeaders() });
    };

    app.handle(req, res);
  });
}

describe('VISTA API Bootstrap & Health Check (Checkpoint C1)', () => {
  it('GET /health/live returns 200 OK with service identifier', async () => {
    const res = await dispatch(app, 'GET', '/health/live');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('vista-api');
    expect(res.body).toHaveProperty('uptimeSec');
  });

  it('GET /health/ready returns 200 and probe checks', async () => {
    const res = await dispatch(app, 'GET', '/health/ready');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('checks');
    expect(res.body.checks).toHaveProperty('database');
    expect(res.body.checks).toHaveProperty('redis');
  });

  it('GET /metrics returns Prometheus format metrics', async () => {
    const res = await dispatch(app, 'GET', '/metrics');
    expect(res.status).toBe(200);
    expect(res.text).toContain('vista_ingest_events_total');
    expect(res.text).toContain('vista_duplicate_events_total');
  });

  it('POST /api/v1/auth/token generates valid JWT for operator with valid credentials', async () => {
    const res = await dispatch(app, 'POST', '/api/v1/auth/token', {
      sub: 'operator-001',
      apiKey: 'vista-op-key-8492',
    });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.role).toBe('operator');
    expect(res.body.user.tenantId).toBe('tenant-default');
  });

  it('POST /api/v1/auth/token rejects unauthenticated request missing credentials (C-01/H-05)', async () => {
    const res = await dispatch(app, 'POST', '/api/v1/auth/token', {
      sub: 'operator-001',
    });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('AUTHENTICATION_REQUIRED');
  });

  it('POST /api/v1/auth/token rejects invalid credentials with 401', async () => {
    const res = await dispatch(app, 'POST', '/api/v1/auth/token', {
      sub: 'operator-001',
      apiKey: 'wrong-key-xyz',
    });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('AUTHENTICATION_FAILED');
  });

  it('GET /api/v1/vehicles/:vin/trust executes cleanly without ReferenceError and fails closed to NO_DATA', async () => {
    const authRes = await dispatch(app, 'POST', '/api/v1/auth/token', {
      sub: 'operator-001',
      apiKey: 'vista-op-key-8492',
    });
    const token = authRes.body.token;

    const res = await dispatch(app, 'GET', '/api/v1/vehicles/VIN-000001/trust?signal=battery_soc', null, {
      authorization: `Bearer ${token}`,
    });

    expect(res.status).toBe(200);
    expect(res.body.vin).toBe('VIN-000001');
    expect(res.body.signal).toBe('battery_soc');
    expect(res.body.status).toBe('NO_DATA');
    expect(res.body.trust).toBe(0.0);
  });

  it('GET /api/v1/decisions/agent/trust/:vin fails closed with trust=0 and NO_DATA when no telemetry exists', async () => {
    const authRes = await dispatch(app, 'POST', '/api/v1/auth/token', {
      sub: 'operator-001',
      apiKey: 'vista-op-key-8492',
    });
    const token = authRes.body.token;

    const res = await dispatch(app, 'GET', '/api/v1/decisions/agent/trust/VIN-000001', null, {
      authorization: `Bearer ${token}`,
    });

    expect(res.status).toBe(200);
    expect(res.body.vin).toBe('VIN-000001');
    expect(res.body.trust).toBe(0.0);
    expect(res.body.status).toBe('NO_DATA');
    expect(res.body.tenantId).toBe('tenant-default');
  });
});
