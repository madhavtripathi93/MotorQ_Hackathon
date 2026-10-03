const { createClient } = require('@clickhouse/client');
const config = require('../../config');
const logger = require('../logger');

class ClickHouseAdapter {
  constructor() {
    this.inMemoryTelemetry = [];
    this.client = null;
    this.isAvailable = false;

    try {
      this.client = createClient({
        url: config.CLICKHOUSE_URL,
        username: config.CLICKHOUSE_USER,
        password: config.CLICKHOUSE_PASSWORD,
        request_timeout: 3000,
        log: {
          LoggerClass: class { trace(){} debug(){} info(){} warn(){} error(){} }
        }
      });

      this.client.ping().then((res) => {
        if (res.success) {
          this.isAvailable = true;
          logger.info('ClickHouse connection established');
        }
      }).catch((err) => {
        this.isAvailable = false;
        logger.warn({ error: err.message }, 'Fallback Triggered: Issue connecting to ClickHouse; analytics fallback active');
      });
    } catch (err) {
      this.isAvailable = false;
    }
  }

  async insertWindowed(rows) {
    if (this.isAvailable && this.client) {
      try {
        await this.client.insert({
          table: 'vista.telemetry_windowed',
          values: rows,
          format: 'JSONEachRow',
        });
        return;
      } catch (err) {
        logger.warn({ err: err.message }, 'ClickHouse insert failed');
        if (config.NODE_ENV === 'production') {
          throw new Error(`FAIL_CLOSED: ClickHouse insert failed in production: ${err.message}`);
        }
      }
    } else if (config.NODE_ENV === 'production') {
      throw new Error('FAIL_CLOSED: ClickHouse cluster is unavailable in production mode.');
    }

    // Keep sliding buffer of last 50,000 telemetry points in memory (development / local fallback)
    for (const r of rows) {
      this.inMemoryTelemetry.push(r);
    }
    if (this.inMemoryTelemetry.length > 50000) {
      this.inMemoryTelemetry.splice(0, this.inMemoryTelemetry.length - 50000);
    }
  }

  async getTreatmentControlWindows({ campaignId, signalName = 'battery_soc' }) {
    if (this.isAvailable && this.client) {
      try {
        const query = `
          SELECT 
            firmware_version,
            value,
            trust_score,
            ts
          FROM vista.telemetry_windowed
          WHERE signal_name = {signal:String}
          ORDER BY ts DESC
          LIMIT 10000
        `;
        const result = await this.client.query({
          query,
          query_params: { signal: signalName },
          format: 'JSONEachRow',
        });
        const rows = await result.json();

        const treatRows = rows.filter(r => r.firmware_version === '4.7');
        const ctrlRows = rows.filter(r => r.firmware_version === '4.6');

        const treatPost = treatRows.filter(r => r.value <= 1.0).map(r => r.value);
        const treatPre = treatRows.filter(r => r.value > 1.0).map(r => r.value);
        const ctrlPost = ctrlRows.slice(0, Math.max(1, Math.floor(ctrlRows.length / 2))).map(r => r.value);
        const ctrlPre = ctrlRows.slice(Math.max(1, Math.floor(ctrlRows.length / 2))).map(r => r.value);

        return {
          treatmentPre: treatPre,
          treatmentPost: treatPost,
          controlPre: ctrlPre,
          controlPost: ctrlPost,
          affectedVehiclesCount: treatRows.length,
        };
      } catch (err) {
        logger.warn({ err: err.message }, 'ClickHouse query failed');
        if (config.NODE_ENV === 'production') {
          throw new Error(`FAIL_CLOSED: ClickHouse query failed in production: ${err.message}`);
        }
      }
    } else if (config.NODE_ENV === 'production') {
      throw new Error('FAIL_CLOSED: ClickHouse cluster is unavailable in production mode.');
    }

    // Partition from sliding buffer
    const treatPoints = this.inMemoryTelemetry.filter(r => r.signal_name === signalName && r.firmware_version === '4.7');
    const ctrlPoints = this.inMemoryTelemetry.filter(r => r.signal_name === signalName && r.firmware_version === '4.6');

    const treatPost = treatPoints.filter(p => p.value <= 1.0).map(p => p.value);
    const treatPre = treatPoints.filter(p => p.value > 1.0).map(p => p.value);
    const halfCtrl = Math.floor(ctrlPoints.length / 2);
    const ctrlPost = ctrlPoints.slice(0, halfCtrl).map(p => p.value);
    const ctrlPre = ctrlPoints.slice(halfCtrl).map(p => p.value);

    return {
      treatmentPre: treatPre,
      treatmentPost: treatPost,
      controlPre: ctrlPre,
      controlPost: ctrlPost,
      affectedVehiclesCount: treatPoints.length,
    };
  }

  async close() {
    if (this.client) await this.client.close();
  }
}

const clickhouseAdapter = new ClickHouseAdapter();
module.exports = clickhouseAdapter;
