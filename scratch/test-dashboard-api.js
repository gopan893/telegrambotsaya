'use strict';

const assert = require('assert');
const auth = require('../src/dashboard/dashboard-auth');
const guards = require('../src/dashboard/dashboard-guards');
const serializers = require('../src/dashboard/dashboard-serializers');

function simulateUnauthorized(env = { DASHBOARD_ENABLED: 'true', DASHBOARD_ADMIN_TOKEN: 'secret-token' }) {
  let statusCode = null;
  let body = null;
  const req = {
    headers: {},
    query: {},
    app: { locals: { dashboardEnv: env } }
  };
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(payload) {
      body = payload;
      return payload;
    }
  };
  auth.requireDashboardAuth(req, res, () => {
    statusCode = 200;
    body = { ok: true };
  });
  return { statusCode, body };
}

function run() {
  const memory = serializers.sanitizeMemory({
    id: 'mem_1',
    type: 'semantic',
    content: 'DATABASE_URL=postgresql://user:password@host/db and token abc',
    metadata: { TELEGRAM_TOKEN: '123' }
  });
  assert(!JSON.stringify(memory).includes('postgresql://user:password'), 'serializer must redact connection strings');
  assert(!JSON.stringify(memory).includes('TELEGRAM_TOKEN'), 'serializer must not expose token-like metadata');

  const envStatus = serializers.sanitizeEnvStatus({
    TELEGRAM_TOKEN: 'real-token',
    DATABASE_URL: 'postgres://secret',
    REDIS_URL: '',
    OPENWEATHER_API_KEY: 'weather',
    TAVILY_API_KEY: '',
    GROQ_API_KEY: 'groq',
    MISTRAL_API_KEY: '',
    DASHBOARD_ADMIN_TOKEN: 'dash'
  });
  assert.deepStrictEqual({
    telegramToken: envStatus.telegramToken,
    databaseUrl: envStatus.databaseUrl,
    redisUrl: envStatus.redisUrl,
    openWeatherApiKey: envStatus.openWeatherApiKey,
    tavilyApiKey: envStatus.tavilyApiKey,
    groqApiKey: envStatus.groqApiKey,
    mistralApiKey: envStatus.mistralApiKey,
    dashboardAdminToken: envStatus.dashboardAdminToken
  }, {
    telegramToken: 'set',
    databaseUrl: 'set',
    redisUrl: 'missing',
    openWeatherApiKey: 'set',
    tavilyApiKey: 'missing',
    groqApiKey: 'set',
    mistralApiKey: 'missing',
    dashboardAdminToken: 'set'
  });
  assert(!JSON.stringify(envStatus).includes('real-token'));
  assert(!JSON.stringify(envStatus).includes('postgres://secret'));

  assert.strictEqual(guards.validateLimit(undefined, 20, 100), 20);
  assert.strictEqual(guards.validateLimit('500', 20, 100), 100);
  assert.strictEqual(guards.validateLimit('7', 20, 100), 7);

  const healthPayload = guards.preventSecretLeak({
    ok: true,
    token: 'secret',
    nested: { databaseUrl: 'postgresql://user:pass@host/db' }
  });
  assert.strictEqual(healthPayload.token, 'set');
  assert.strictEqual(healthPayload.nested.databaseUrl, 'set');
  assert(!JSON.stringify(healthPayload).includes('user:pass'), 'health payload must not contain secret');

  const unauthorized = simulateUnauthorized();
  assert.strictEqual(unauthorized.statusCode, 401, 'protected endpoint without token should return 401');
  assert.strictEqual(unauthorized.body.error, 'UNAUTHORIZED');

  console.log('Dashboard API tests passed');
}

run();
