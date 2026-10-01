const VehicleModel = require('../generators/vehicleModel');
const { faultInjector } = require('../faults/faultInjector');
const { publish } = require('../../../api/src/shared/kafka/producer');
const logger = require('../../../api/src/shared/logger');
const crypto = require('crypto');

class StreamProducer {
  constructor() {
    this.vehicles = [];
    this.isRunning = false;
    this.eventsProduced = 0;
    this.timer = null;
  }

  async initFleet(count = 1000) {
    this.vehicles = [];
    for (let i = 1; i <= count; i++) {
      const vinNum = String(i).padStart(6, '0');
      this.vehicles.push(new VehicleModel(`VIN-${vinNum}`, i));
    }
  }

  async startStream({ count = 200, batchIntervalMs = 1000 }) {
    if (this.isRunning) return;
    this.isRunning = true;
    if (this.vehicles.length < count) {
      await this.initFleet(count);
    }

    logger.info({ vehicleCount: count, intervalMs: batchIntervalMs }, 'Starting telemetry simulator stream -> telemetry.raw.v1');

    this.timer = setInterval(async () => {
      if (!this.isRunning) return;
      const batchSize = Math.min(count, this.vehicles.length);

      for (let i = 0; i < batchSize; i++) {
        const v = this.vehicles[i];
        const rawEvent = v.tick(batchIntervalMs / 1000.0);
        const injectedEvents = faultInjector.applyFault(rawEvent, v);

        for (const ev of injectedEvents) {
          this.eventsProduced += 1;
          const vinHash = crypto.createHash('sha256').update(ev.vin).digest('hex').slice(0, 16);

          // Publish ONLY to Kafka raw telemetry boundary topic (durable streaming boundary)
          publish('telemetry.raw.v1', vinHash, ev).catch((err) => {
            logger.warn({ err: err.message, vin: ev.vin }, 'Failed to publish to telemetry.raw.v1');
          });
        }
      }
    }, batchIntervalMs);
  }

  stopStream() {
    this.isRunning = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    logger.info({ totalEventsProduced: this.eventsProduced }, 'Simulator stream halted');
  }
}

const streamProducer = new StreamProducer();
module.exports = { streamProducer, StreamProducer };
