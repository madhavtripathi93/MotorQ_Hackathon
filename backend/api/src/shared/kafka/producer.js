const { Kafka, Partitioners, logLevel } = require('kafkajs');
const config = require('../../config');
const logger = require('../logger');
const { EventEmitter } = require('events');

process.env.KAFKAJS_NO_PARTITIONER_WARNING = '1';

const inMemoryEventBus = new EventEmitter();
inMemoryEventBus.setMaxListeners(100);

let producer = null;
let isKafkaConnected = false;

try {
  const kafka = new Kafka({
    clientId: 'vista-api',
    brokers: config.KAFKA_BROKERS.split(','),
    logLevel: logLevel.NOTHING,
    connectionTimeout: 2000,
    retry: { retries: 1 },
  });

  producer = kafka.producer({
    allowAutoTopicCreation: true,
    createPartitioner: Partitioners.LegacyPartitioner,
  });

  producer.connect().then(() => {
    isKafkaConnected = true;
    logger.info('Connected to Kafka producer successfully');
  }).catch((err) => {
    isKafkaConnected = false;
    logger.warn({ error: err.message }, 'Fallback Triggered: Issue connecting to Kafka producer; using internal event bus');
  });
} catch (err) {
  isKafkaConnected = false;
}

async function publish(topic, key, payload) {
  const jsonPayload = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const parsedPayload = typeof payload === 'string' ? JSON.parse(payload) : payload;

  // Always emit to local event bus for real-time subscribers & WebSocket sync
  inMemoryEventBus.emit(topic, { key, payload: parsedPayload });
  inMemoryEventBus.emit('*', { topic, key, payload: parsedPayload });

  if (isKafkaConnected && producer) {
    try {
      await producer.send({
        topic,
        messages: [{ key: String(key), value: jsonPayload }],
      });
      return;
    } catch (err) {
      logger.warn({ err: err.message, topic }, 'Kafka publish failed, routed via internal event bus');
      isKafkaConnected = false;
    }
  }
}

function subscribeLocal(topic, handler) {
  inMemoryEventBus.on(topic, handler);
}

module.exports = {
  producer,
  publish,
  subscribeLocal,
  isKafkaConnected: () => isKafkaConnected,
  disconnect: async () => {
    if (isKafkaConnected && producer) {
      await producer.disconnect();
    }
  },
};
