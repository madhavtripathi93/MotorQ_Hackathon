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
const DEMO_OPERATOR_KEY = process.env.DEMO_OPERATOR_KEY || 'vista-op-key-8492';
const DEMO_ADMIN_KEY = process.env.DEMO_ADMIN_KEY || 'vista-admin-key-9912';
const DEMO_AUDITOR_KEY = process.env.DEMO_AUDITOR_KEY || 'vista-audit-key-3310';
const DEMO_TENANTB_KEY = process.env.DEMO_TENANTB_KEY || 'vista-tenantb-key-5511';

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
  'auditor-001': {
    role: 'auditor',
    tenant_id: 'tenant-default',
    name: 'Regulatory Compliance Officer (Demo)',
    credentialHash: hashCredential(DEMO_AUDITOR_KEY),
  },
  'operator-tenant-b': {
    role: 'operator',
    tenant_id: 'tenant-logistics-corp',
    name: 'Tenant B Fleet Lead (Demo)',
    credentialHash: hashCredential(DEMO_TENANTB_KEY),
  },
};

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

  const account = REGISTERED_ACCOUNTS[sub];
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
