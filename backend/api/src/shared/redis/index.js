const Redis = require('ioredis');
const config = require('../../config');
const logger = require('../logger');

class InMemoryRedisFallback {
  constructor() {
    this.store = new Map();
    this.sets = new Map();
    this.ttls = new Map();
  }

  async get(key) {
    if (this._isExpired(key)) return null;
    return this.store.get(key) || null;
  }

  async set(key, val, exType, ttlSeconds) {
    this.store.set(key, val);
    if (exType === 'EX' && ttlSeconds) {
      this.ttls.set(key, Date.now() + ttlSeconds * 1000);
    }
    return 'OK';
  }

  async del(key) {
    this.store.delete(key);
    this.sets.delete(key);
    this.ttls.delete(key);
    return 1;
  }

  async sadd(key, member) {
    if (!this.sets.has(key)) {
      this.sets.set(key, new Set());
    }
    const set = this.sets.get(key);
    if (set.has(member)) return 0;
    set.add(member);
    return 1;
  }

  async sismember(key, member) {
    const set = this.sets.get(key);
    return set && set.has(member) ? 1 : 0;
  }

  async expire(key, ttlSeconds) {
    this.ttls.set(key, Date.now() + ttlSeconds * 1000);
    return 1;
  }

  async quit() {
    return 'OK';
  }

  _isExpired(key) {
    if (this.ttls.has(key)) {
      if (Date.now() > this.ttls.get(key)) {
        this.store.delete(key);
        this.sets.delete(key);
        this.ttls.delete(key);
        return true;
      }
    }
    return false;
  }
}

let redisClient;
let isFallback = false;

try {
  redisClient = new Redis(config.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    retryStrategy: () => null, // don't hang indefinitely on test/standalone
  });

  redisClient.on('error', (err) => {
    if (!isFallback) {
      logger.warn({ err: err.message }, 'Redis unreachable, switching to bounded in-process fallback');
      isFallback = true;
    }
  });

  redisClient.connect().catch(() => {
    isFallback = true;
  });
} catch (err) {
  isFallback = true;
}

const fallback = new InMemoryRedisFallback();

const proxy = new Proxy({}, {
  get(target, prop) {
    if (isFallback) {
      if (config.NODE_ENV === 'production') {
        throw new Error('FAIL_CLOSED: Redis cluster unavailable in production mode. Refusing non-authoritative fallback.');
      }
      return typeof fallback[prop] === 'function' ? fallback[prop].bind(fallback) : fallback[prop];
    }
    const realProp = redisClient[prop];
    if (typeof realProp === 'function') {
      return async (...args) => {
        try {
          return await realProp.apply(redisClient, args);
        } catch (err) {
          logger.warn({ err: err.message }, 'Redis call failed');
          if (config.NODE_ENV === 'production') {
            throw new Error(`FAIL_CLOSED: Redis operation failed in production: ${err.message}`);
          }
          isFallback = true;
          return fallback[prop](...args);
        }
      };
    }
    return realProp;
  }
});

module.exports = proxy;
