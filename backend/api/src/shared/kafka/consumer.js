const { Kafka } = require('kafkajs');
const config = require('../../config');
const logger = require('../logger');

class KafkaConsumerManager {
  constructor() {
    this.consumer = null;
    this.isConnected = false;
  }

  async startConsumer({ groupId, topic, eachMessage }) {
    try {
      const kafka = new Kafka({
        clientId: `vista-consumer-${groupId}`,
        brokers: config.KAFKA_BROKERS.split(','),
        connectionTimeout: 2000,
        retry: { retries: 2 },
      });

      this.consumer = kafka.consumer({
        groupId,
        sessionTimeout: 30000,
        heartbeatInterval: 3000,
      });

      await this.consumer.connect();
      this.isConnected = true;
      logger.info({ groupId, topic }, 'Kafka consumer group connected successfully');

      await this.consumer.subscribe({ topic, fromBeginning: false });

      await this.consumer.run({
        autoCommit: true,
        eachMessage: async ({ topic, partition, message }) => {
          try {
            const rawString = message.value.toString();
            const payload = JSON.parse(rawString);
            await eachMessage({ topic, partition, message, payload, key: message.key ? message.key.toString() : null });
          } catch (err) {
            logger.error({ err: err.message, topic, partition }, 'Error handling Kafka message in consumer');
          }
        },
      });
    } catch (err) {
      this.isConnected = false;
      logger.warn({ err: err.message, groupId, topic }, 'Kafka consumer connection failed; falling back to event bus subscription');
    }
  }

  async disconnect() {
    if (this.isConnected && this.consumer) {
      await this.consumer.disconnect();
      this.isConnected = false;
    }
  }
}

module.exports = { KafkaConsumerManager };
