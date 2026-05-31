'use strict';

const assert = require('assert');
const guards = require('../src/dashboard/dashboard-guards');
const serializers = require('../src/dashboard/dashboard-serializers');

function makeRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return payload;
    }
  };
}

function runRateLimit() {
  let blocked = false;
  for (let i = 0; i < 11; i++) {
    const req = {
      ip: '203.0.113.11',
      headers: { authorization: 'Bearer token-for-rate-test' },
      query: {}
    };
    const res = makeRes();
    guards.rateLimitDashboardAction(req, res, () => {});
    if (res.statusCode === 429) blocked = true;
  }
  return blocked;
}

function run() {
  const leaked = guards.preventSecretLeak({
    TELEGRAM_TOKEN: '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11',
    DATABASE_URL: 'postgresql://postgres:secretpassword@localhost:5432/db',
    REDIS_URL: 'redis://default:secret@host:6379',
    OPENAI_API_KEY: 'sk-proj-12345678901234567890',
    GROQ_API_KEY: 'gsk-12345678901234567890',
    MISTRAL_API_KEY: 'mistral-12345678901234567890',
    TAVILY_API_KEY: 'tvly-12345678901234567890',
    nested: {
      safe: 'ok'
    }
  });

  const leakedJson = JSON.stringify(leaked);
  assert(!leakedJson.includes('ABC-DEF1234ghIkl'));
  assert(!leakedJson.includes('secretpassword'));
  assert(!leakedJson.includes('redis://default:secret'));
  assert(!leakedJson.includes('sk-proj'));
  assert(!leakedJson.includes('12345678901234567890'));

  const env = serializers.sanitizeEnvStatus({
    TELEGRAM_TOKEN: 'token',
    DATABASE_URL: 'db',
    REDIS_URL: '',
    OPENWEATHER_API_KEY: 'weather',
    TAVILY_API_KEY: '',
    GROQ_API_KEY: 'groq',
    MISTRAL_API_KEY: '',
    DASHBOARD_ADMIN_TOKEN: 'dashboard'
  });
  assert.deepStrictEqual(env, {
    telegramToken: 'set',
    databaseUrl: 'set',
    redisUrl: 'missing',
    openWeatherApiKey: 'set',
    tavilyApiKey: 'missing',
    groqApiKey: 'set',
    mistralApiKey: 'missing',
    dashboardAdminToken: 'set'
  });

  const long = serializers.truncateText('a'.repeat(800), 120);
  assert(long.length <= 120);

  assert.strictEqual(runRateLimit(), true, 'action endpoint should rate limit after 10 requests/minute');
  console.log('Dashboard security tests passed');
}

run();
