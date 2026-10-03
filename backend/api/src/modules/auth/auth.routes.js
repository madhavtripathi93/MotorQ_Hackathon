const express = require('express');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { generateToken } = require('../../shared/middleware/auth.middleware');
const config = require('../../config');

// Rate limiter: 10 attempts per minute per IP to prevent brute-forcing
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'TOO_MANY_REQUESTS',
    message: 'Too many authentication attempts from this IP. Please try again after 60 seconds.',
  },
  skip: () => process.env.NODE_ENV === 'test', // Bypass in automated test suites
});

// Helper to compute salted SHA-256 hash
function hashCredential(cred, salt = config.TENANT_SALT) {
  return crypto.createHash('sha256').update(cred + ':' + salt).digest('hex');
}

// Pre-registered evaluation directory (overrideable via environment)
const DEMO_OPERATOR_KEY = process.env.DEMO_OPERATOR_KEY;
const DEMO_ADMIN_KEY = process.env.DEMO_ADMIN_KEY;
const DEMO_AUDITOR_KEY = process.env.DEMO_AUDITOR_KEY;
const DEMO_TENANTB_KEY = process.env.DEMO_TENANTB_KEY;

const REGISTERED_ACCOUNTS = {
  'operator-001': {
    role: 'operator',
    tenant_id: 'tenant-default',
    name: 'Primary Fleet Operator (Demo)',
    credentialHash: hashCredential(DEMO_OPERATOR_KEY),
  },
  'admin-001': {
    role: 'admin',
    tenant_id: 'tenant-default',
    name: 'System Security Admin (Demo)',
    credentialHash: hashCredential(DEMO_ADMIN_KEY),
  },
};

const db = require('../../shared/db');
if (!db.inMemoryStore.users) {
  db.inMemoryStore.users = new Map(Object.entries(REGISTERED_ACCOUNTS));
}

// POST /api/v1/auth/register
router.post('/auth/register', authLimiter, async (req, res) => {
  const { sub, password, name, tenant_id } = req.body || {};
  if (!sub || !password) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'Username (sub) and password required' });
  }
  if (db.inMemoryStore.users.has(sub)) {
    return res.status(409).json({ error: 'CONFLICT', message: 'User already exists' });
  }

  const tenantId = tenant_id || `tenant-${sub}`;
  const newUser = {
    role: 'operator',
    tenant_id: tenantId,
    name: name || sub,
    credentialHash: hashCredential(password)
  };
  
  db.inMemoryStore.users.set(sub, newUser);

  // Seed demo data for the new tenant
  try {
    const crypto = require('crypto');
    const fleetId = crypto.randomUUID();
    
    // In-Memory seeding
    for (const [vin, v] of db.inMemoryStore.vehicles.entries()) {
      if (v.tenant_id === 'tenant-default') {
        const newVin = `VIN-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
        db.inMemoryStore.vehicles.set(newVin, { ...v, id: crypto.randomUUID(), tenant_id: tenantId, vin: newVin, fleet_id: fleetId });
        
        const sw = db.inMemoryStore.vehicleSoftware.get(`${vin}-sw`);
        if (sw) {
          db.inMemoryStore.vehicleSoftware.set(`${newVin}-sw`, { ...sw, vin: newVin });
        }
        
        // Ensure provenance (firmware cohort) is cloned for veracity attribution
        const prov = db.inMemoryStore.provenance.get(vin);
        if (prov) {
          db.inMemoryStore.provenance.set(newVin, prov);
        }
      }
    }

    // Postgres seeding (if live)
    if (db.isLive()) {
      await db.query('INSERT INTO fleet (id, tenant_id, name) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [fleetId, tenantId, `${newUser.name} Fleet`]);
      for (const [vin, v] of db.inMemoryStore.vehicles.entries()) {
        if (v.tenant_id === tenantId) {
          await db.query(
            'INSERT INTO vehicle (id, tenant_id, vin, fleet_id, oem, model, year, firmware_version, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT DO NOTHING',
            [v.id, v.tenant_id, v.vin, fleetId, v.oem, v.model, v.year, v.firmware_version, v.created_at]
          );
        }
      }
    }
  } catch (err) {
    console.error('Failed to seed demo tenant data:', err);
  }

  const token = generateToken({
    sub,
    role: newUser.role,
    tenant_id: newUser.tenant_id,
    name: newUser.name,
  });

  return res.status(201).json({
    token,
    user: { sub, role: newUser.role, tenantId: newUser.tenant_id, name: newUser.name },
    expiresIn: '24h',
  });
});

// POST /api/v1/auth/token
// Security: Requires valid credentials. Disallows caller-selected roles and tenants.
router.post('/auth/token', authLimiter, (req, res) => {
  const { sub, apiKey, password } = req.body || {};
  const providedCred = apiKey || password;

  if (!sub || !providedCred) {
    return res.status(401).json({
      error: 'AUTHENTICATION_REQUIRED',
      message: 'Both account subject (sub) and credential (apiKey or password) are required.',
    });
  }

  const account = db.inMemoryStore.users.get(sub);
  if (!account) {
    return res.status(401).json({
      error: 'AUTHENTICATION_FAILED',
      message: 'Invalid user credentials or unregistered account identity.',
    });
  }

  // Timing-safe comparison of credential hashes
  const inputHash = hashCredential(providedCred);
  const inputBuffer = Buffer.from(inputHash, 'utf8');
  const targetBuffer = Buffer.from(account.credentialHash, 'utf8');

  let isMatch = false;
  try {
    isMatch = crypto.timingSafeEqual(inputBuffer, targetBuffer);
  } catch (err) {
    isMatch = false;
  }

  if (!isMatch) {
    return res.status(401).json({
      error: 'AUTHENTICATION_FAILED',
      message: 'Invalid user credentials or unregistered account identity.',
    });
  }

  // Token claims are derived strictly from server-side directory
  const token = generateToken({
    sub,
    role: account.role,
    tenant_id: account.tenant_id,
    name: account.name,
  });

  return res.status(200).json({
    token,
    user: {
      sub,
      role: account.role,
      tenantId: account.tenant_id,
      name: account.name,
    },
    expiresIn: '24h',
  });
});

module.exports = router;
