// Initialize OpenTelemetry first before any application modules
const { initTelemetry } = require('./observability/instrumentation');
initTelemetry();

const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const config = require('./config');
const logger = require('./shared/logger');
const { verifyJwt } = require('./shared/middleware/auth.middleware');
const { subscribeLocal, disconnect: disconnectKafka } = require('./shared/kafka/producer');
const db = require('./shared/db');
const redis = require('./shared/redis');

const { streamingWorker } = require('./veracity/streamingWorker');

const server = http.createServer(app);

// Mount Socket.IO
const io = new Server(server, {
  cors: {
    origin: [config.UI_ORIGIN, 'http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true,
  },
});

// Socket.IO handshake authentication (Section 22)
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) {
      // In production, strictly reject unauthenticated socket connections
      if (config.NODE_ENV === 'production') {
        logger.warn({ socketId: socket.id }, 'Socket connection rejected: missing authentication token in production');
        return next(new Error('AUTHENTICATION_REQUIRED'));
      }
      // Local development/demo fallback
      socket.user = { sub: 'demo-ui-user', tenant_id: 'tenant-default', role: 'operator' };
      socket.tenantId = 'tenant-default';
      return next();
    }
    const claims = verifyJwt(token);
    socket.user = claims;
    socket.tenantId = claims.tenant_id || 'tenant-default';
    return next();
  } catch (err) {
    logger.warn({ err: err.message }, 'Socket.IO handshake authentication failed');
    return next(new Error('UNAUTHORIZED'));
  }
});

io.on('connection', (socket) => {
  const tenantId = socket.tenantId || 'tenant-default';
  socket.join(`tenant:${tenantId}`);
  logger.info({ socketId: socket.id, tenantId }, 'Browser client connected to real-time telemetry stream');

  socket.on('disconnect', () => {
    logger.info({ socketId: socket.id }, 'Browser client disconnected');
  });
});

// Broadcast real-time veracity & incident updates to tenant-specific WebSocket rooms
subscribeLocal('telemetry.veracity.v1', ({ key, payload }) => {
  const tenantId = payload?.tenant_id || payload?.tenantId || 'tenant-default';
  io.to(`tenant:${tenantId}`).emit('trust.updated', payload);
});

subscribeLocal('telemetry.quarantine.v1', ({ key, payload }) => {
  const tenantId = payload?.tenant_id || payload?.tenantId || 'tenant-default';
  io.to(`tenant:${tenantId}`).emit('trust.quarantined', payload);
});

subscribeLocal('incidents.v1', ({ key, payload }) => {
  const tenantId = payload?.tenant_id || payload?.tenantId || 'tenant-default';
  if (payload.type === 'INCIDENT_CREATED') {
    io.to(`tenant:${tenantId}`).emit('incident.created', payload);
  } else if (payload.type === 'SCENARIO_STARTED' || payload.type === 'SCENARIO_STOPPED') {
    io.to(`tenant:${tenantId}`).emit('scenario.state', payload);
  } else if (payload.type === 'COHORT_ATTRIBUTION_COMPLETED') {
    io.to(`tenant:${tenantId}`).emit('incident.attributed', payload);
  }
});

subscribeLocal('decisions.v1', ({ key, payload }) => {
  const tenantId = payload?.tenant_id || payload?.tenantId || 'tenant-default';
  if (payload.outcome === 'BLOCK') {
    io.to(`tenant:${tenantId}`).emit('decision.blocked', payload);
  }
});

// Server start & streaming pipeline initialization
const PORT = config.PORT || 3000;
server.listen(PORT, async () => {
  logger.info({ port: PORT, env: config.NODE_ENV }, '🚀 VISTA Control Plane API & WebSocket server live');
  // Start streaming veracity consumer on telemetry.raw.v1
  await streamingWorker.startWorker();
});

// Graceful process shutdown (Section 8)
async function shutdown(signal) {
  logger.info({ signal }, 'Graceful shutdown requested. Halting intake...');
  try {
    // 1. Close HTTP/WS intake
    server.close(() => {
      logger.info('HTTP server closed');
    });

    // 2. Disconnect Kafka
    await disconnectKafka();

    // 3. Disconnect Redis
    await redis.quit();

    // 4. Disconnect DB
    await db.end();

    logger.info('VISTA graceful shutdown complete');
    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'Error during graceful shutdown');
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = server;
