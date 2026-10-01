const { streamingWorker } = require('../../api/src/veracity/streamingWorker');
const logger = require('../../api/src/shared/logger');

async function main() {
  logger.info('Starting standalone VISTA Streaming Veracity Data Plane Worker (Node 24 LTS)...');
  await streamingWorker.startWorker();

  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received. Halting streaming worker...');
    await streamingWorker.stopWorker();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    logger.info('SIGINT received. Halting streaming worker...');
    await streamingWorker.stopWorker();
    process.exit(0);
  });
}

main().catch((err) => {
  logger.fatal({ err: err.message }, 'Fatal crash in streaming worker main loop');
  process.exit(1);
});
