const veracityEngine = require('./veracityEngine');
const contractRepo = require('../modules/contracts/contract.repository');
const { subscribeLocal } = require('../shared/kafka/producer');
const { KafkaConsumerManager } = require('../shared/kafka/consumer');
const metrics = require('../observability/metrics');
const logger = require('../shared/logger');

class StreamingVeracityWorker {
  constructor() {
    this.consumerManager = new KafkaConsumerManager();
    this.contractCache = new Map();
    this.lastCacheRefresh = 0;
    this.CACHE_TTL_MS = 60000; // 1 minute
    this.processedCount = 0;
    this.isStarted = false;
  }

  async getContractForSignal(signalName) {
    const now = Date.now();
    if (this.contractCache.has(signalName) && (now - this.lastCacheRefresh < this.CACHE_TTL_MS)) {
      return this.contractCache.get(signalName);
    }

    try {
      const contract = await contractRepo.getActiveContract(signalName);
      if (contract) {
        this.contractCache.set(signalName, contract);
      }
      this.lastCacheRefresh = now;
      return contract || null;
    } catch (err) {
      logger.warn({ err: err.message, signalName }, 'Could not retrieve contract from repository');
      return this.contractCache.get(signalName) || null;
    }
  }

  async processRawEvent(event) {
    const start = Date.now();
    try {
      const signalName = event.signal || (event.signals ? Object.keys(event.signals)[0] : 'battery_soc');
      const contract = await this.getContractForSignal(signalName);

      const result = await veracityEngine.processTelemetry(event, contract);
      this.processedCount++;

      metrics.inc('vista_streaming_worker_processed_total', 1, { signal: signalName });
      metrics.observe('vista_streaming_latency_ms', Date.now() - start);

      return result;
    } catch (err) {
      logger.error({ err: err.message, vin: event.vin }, 'Error in StreamingVeracityWorker pipeline');
      return null;
    }
  }

  async startWorker() {
    if (this.isStarted) return;
    this.isStarted = true;

    // 1. Hook into in-memory event bus (always active for local dev, test runs, and broker failover)
    subscribeLocal('telemetry.raw.v1', async ({ key, payload }) => {
      await this.processRawEvent(payload);
    });

    // 2. Start Kafka Consumer group for cluster deployment
    await this.consumerManager.startConsumer({
      groupId: 'vista-veracity-stream-workers',
      topic: 'telemetry.raw.v1',
      eachMessage: async ({ payload }) => {
        await this.processRawEvent(payload);
      },
    });

    logger.info('VISTA Streaming Veracity Worker initialized on telemetry.raw.v1');
  }

  async stopWorker() {
    if (!this.isStarted) return;
    await this.consumerManager.disconnect();
    this.isStarted = false;
    logger.info({ processedCount: this.processedCount }, 'Streaming Veracity Worker stopped');
  }
}

const streamingWorker = new StreamingVeracityWorker();
module.exports = { streamingWorker, StreamingVeracityWorker };
