const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const pinoHttp = require('pino-http');
const compression = require('compression');
const config = require('./config');
const logger = require('./shared/logger');
const requestIdMiddleware = require('./shared/middleware/requestId.middleware');
const errorHandlerMiddleware = require('./shared/middleware/errorHandler.middleware');

// Repositories / probes for readiness check
const db = require('./shared/db');
const redis = require('./shared/redis');
const kafka = require('./shared/kafka/producer');
const clickhouse = require('./shared/adapters/clickhouse.adapter');

// Module routes
const contractRoutes = require('./modules/contracts/contract.routes');
const incidentRoutes = require('./modules/incidents/incident.routes');
const decisionRoutes = require('./modules/decisions/decision.routes');
const vehicleRoutes = require('./modules/vehicles/vehicle.routes');
const scenarioRoutes = require('./modules/scenarios/scenario.routes');
const auditRoutes = require('./modules/audit/audit.routes');
const metricsRoutes = require('./modules/metrics/metrics.routes');
const authRoutes = require('./modules/auth/auth.routes');

const app = express();

// Security & cross-cutting middleware
const isProd = config.NODE_ENV === 'production';

app.use(helmet({
  contentSecurityPolicy: isProd
    ? {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          connectSrc: ["'self'", config.UI_ORIGIN],
        },
      }
    : false,
}));

// Restrict CORS origins in production
const allowedOrigins = isProd
  ? [config.UI_ORIGIN]
  : [config.UI_ORIGIN, 'http://localhost:5173', 'http://127.0.0.1:5173'];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));
app.use(compression());
app.use(express.json({ limit: '256kb' }));
app.use(requestIdMiddleware);

if (config.NODE_ENV !== 'test') {
  app.use(pinoHttp({
    logger,
    customProps: (req) => ({
      requestId: req.id,
      tenantId: req.tenantId || req.headers['x-tenant-id'] || 'anonymous',
    }),
    autoLogging: {
      ignore: (req) => {
        const url = req.url;
        return url.includes('/health') || 
               url.includes('/metrics') || 
               url.includes('/incidents') || 
               url.includes('/scenarios/active');
      },
    },
  }));
}

// Health probes
app.get('/health/live', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'vista-api',
    uptimeSec: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.get('/health/ready', async (req, res) => {
  const isDbLive = db.isLive();
  const isRedisLive = redis.isAvailable || (redis.client && redis.client.status === 'ready');
  const isKafkaLive = kafka.isKafkaConnected();
  const isClickHouseLive = clickhouse.isAvailable;

  const checks = {
    database: isDbLive ? 'connected' : 'in-memory-fallback',
    redis: isRedisLive ? 'connected' : 'in-memory-fallback',
    kafka: isKafkaLive ? 'connected' : 'in-memory-fallback',
    clickhouse: isClickHouseLive ? 'connected' : 'buffer-fallback',
  };

  const isProduction = config.NODE_ENV === 'production';
  const isHealthy = isProduction
    ? (isDbLive && isRedisLive && isKafkaLive && isClickHouseLive)
    : (isDbLive && isRedisLive && isKafkaLive);

  // Production fail-closed on dependency failure
  if (isProduction && !isHealthy) {
    return res.status(503).json({
      status: 'not_ready',
      mode: 'production',
      error: 'CRITICAL_DEPENDENCY_OFFLINE',
      checks,
      timestamp: new Date().toISOString(),
    });
  }

  res.status(200).json({
    status: isHealthy ? 'ready' : 'degraded',
    mode: isProduction ? 'production' : 'development',
    checks,
    timestamp: new Date().toISOString(),
  });
});

// Mount VISTA API v1 routes
app.use('/api/v1', contractRoutes);
app.use('/api/v1', incidentRoutes);
app.use('/api/v1', decisionRoutes);
app.use('/api/v1', vehicleRoutes);
app.use('/api/v1', scenarioRoutes);
app.use('/api/v1', auditRoutes);
app.use('/api/v1', metricsRoutes);
app.use('/api/v1', authRoutes);

// Root metrics
app.use('/', metricsRoutes);

// Central error handler
app.use(errorHandlerMiddleware);

module.exports = app;
