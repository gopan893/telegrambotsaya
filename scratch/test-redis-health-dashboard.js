'use strict';

const assert = require('assert');
const { checkRedisHealth } = require('../src/storage/redis-store');
const { formatRedisStatus } = require('../src/dashboard/storage-status-formatters');

class FakeRedisOk {
  constructor() {
    this.closed = false;
  }
  async connect() {
    return 'OK';
  }
  async ping() {
    return 'PONG';
  }
  async quit() {
    this.closed = true;
  }
}

class FakeRedisTlsFail {
  async connect() {
    throw new Error('TLS certificate error');
  }
  disconnect() {}
}

async function main() {
  const missing = await checkRedisHealth({
    redisUrl: '',
    env: {},
    force: true,
    cacheTtlMs: 0
  });
  assert.strictEqual(missing.configured, false);
  assert.strictEqual(missing.available, false);
  assert.strictEqual(missing.status, 'missing_env');

  const connected = await checkRedisHealth({
    RedisClass: FakeRedisOk,
    redisUrl: 'redis://:secret@example.com:6379/0',
    env: { REDIS_URL: 'redis://:secret@example.com:6379/0' },
    force: true,
    cacheTtlMs: 0
  });
  assert.strictEqual(connected.configured, true);
  assert.strictEqual(connected.available, true);
  assert.strictEqual(connected.status, 'connected');

  const tls = await checkRedisHealth({
    RedisClass: FakeRedisTlsFail,
    redisUrl: 'rediss://:secret@example.com:6379/0',
    env: { REDIS_URL: 'rediss://:secret@example.com:6379/0' },
    force: true,
    cacheTtlMs: 0
  });
  assert.strictEqual(tls.available, false);
  assert.strictEqual(tls.status, 'tls_issue');

  const text = formatRedisStatus({
    driver: 'json',
    redisConfigured: true,
    cache: { health: tls }
  });
  assert.ok(text.includes('Redis Status'));
  assert.ok(!text.includes('secret'));
  assert.ok(!text.includes('rediss://'));

  console.log('test-redis-health-dashboard: ok');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
