/**
 * Redis caching service — cache-aside pattern with fallback
 * Wraps ioredis with getOrSet() helper for clean usage across services.
 */

const Redis = require('ioredis');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

let client = null;
let connectionFailed = false;

function getClient() {
  if (connectionFailed) return null;
  if (!client) {
    client = new Redis(REDIS_URL, {
      lazyConnect: true,
      retryStrategy: (times) => {
        if (times > 3) {
          connectionFailed = true;
          console.warn('[Redis] Connection failed — running without cache');
          return null;
        }
        return Math.min(times * 200, 2000);
      },
      enableOfflineQueue: false,
    });

    client.on('connect', () => console.log('[Redis] Connected'));
    client.on('error', (err) => {
      if (!connectionFailed) console.warn('[Redis] Error:', err.message);
    });
  }
  return client;
}

/**
 * O(1) — Cache-aside: return cached value or fetch, store, and return.
 * @param {string} key         Redis key
 * @param {Function} fetchFn   Async function that returns the fresh value
 * @param {number} ttlSeconds  Cache TTL (default: 1 hour)
 * @returns {Promise<any>}
 */
async function getOrSet(key, fetchFn, ttlSeconds = 3600) {
  const redis = getClient();

  if (redis) {
    try {
      const cached = await redis.get(key);
      if (cached !== null) {
        return JSON.parse(cached);
      }
    } catch (e) {
      console.warn('[Redis] get error:', e.message);
    }
  }

  // Cache miss — fetch fresh value
  const value = await fetchFn();

  if (redis && value !== null && value !== undefined) {
    try {
      await redis.setex(key, ttlSeconds, JSON.stringify(value));
    } catch (e) {
      console.warn('[Redis] set error:', e.message);
    }
  }

  return value;
}

/**
 * O(1) — Delete a cached key (used when data changes).
 */
async function invalidate(key) {
  const redis = getClient();
  if (redis) {
    try { await redis.del(key); } catch (e) { /* ignore */ }
  }
}

/**
 * O(1) — Get raw value.
 */
async function get(key) {
  const redis = getClient();
  if (!redis) return null;
  try {
    const v = await redis.get(key);
    return v ? JSON.parse(v) : null;
  } catch { return null; }
}

/**
 * O(1) — Set with TTL.
 */
async function set(key, value, ttlSeconds = 3600) {
  const redis = getClient();
  if (!redis) return;
  try {
    await redis.setex(key, ttlSeconds, JSON.stringify(value));
  } catch (e) {
    console.warn('[Redis] set error:', e.message);
  }
}

module.exports = { getOrSet, invalidate, get, set, getClient };
