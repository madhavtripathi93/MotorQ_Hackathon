// OpenTelemetry Node.js Instrumentation Bootstrap
const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const logger = require('../shared/logger');

let sdk = null;

function initTelemetry() {
  if (process.env.OTEL_ENABLED !== 'true') {
    logger.info('OpenTelemetry initialized in lightweight local mode');
    return;
  }

  try {
    sdk = new NodeSDK({
      serviceName: 'vista-api',
      instrumentations: [getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false }
      })],
    });

    sdk.start();
    logger.info('OpenTelemetry SDK started successfully');
  } catch (err) {
    logger.warn({ err: err.message }, 'OpenTelemetry initialization skipped in local test environment');
  }
}

module.exports = { initTelemetry, sdk };
