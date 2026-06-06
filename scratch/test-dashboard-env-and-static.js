'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const express = require('express');
const { readEnv } = require('../config/env');
const auth = require('../src/dashboard/dashboard-auth');
const serializers = require('../src/dashboard/dashboard-serializers');
const dashboard = require('../src/dashboard');

function run() {
  const config = readEnv({
    TELEGRAM_TOKEN: 'telegram-token',
    MISTRAL_API_KEY: 'mistral-key',
    DASHBOARD_ENABLED: 'true',
    DASHBOARD_ADMIN_TOKEN: 'dashboard-secret',
    RENDER_EXTERNAL_HOSTNAME: 'telegrambotsaya.onrender.com'
  });

  assert.strictEqual(config.DASHBOARD_ENABLED, true);
  assert.strictEqual(config.dashboard.enabled, true);
  assert.strictEqual(config.dashboard.tokenConfigured, true);

  const status = auth.getDashboardStatus(config);
  assert.strictEqual(status.enabled, true);
  assert.strictEqual(status.tokenConfigured, true);
  assert(!JSON.stringify(status).includes('dashboard-secret'));

  const health = serializers.sanitizeHealth({
    ok: true,
    uptime: 1,
    version: 'test',
    dashboardEnabled: true,
    tokenConfigured: true,
    token: 'dashboard-secret'
  });
  assert.strictEqual(health.dashboardEnabled, true);
  assert.strictEqual(health.tokenConfigured, true);
  assert(!JSON.stringify(health).includes('dashboard-secret'));

  const publicDir = path.join(process.cwd(), 'public', 'dashboard');
  const indexHtml = fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8');
  const apiJs = fs.readFileSync(path.join(publicDir, 'api.js'), 'utf8');

  assert(/href="\/dashboard\/styles\.css(?:\?[^"]*)?"/.test(indexHtml));
  assert(/src="\/dashboard\/app\.js(?:\?[^"]*)?"/.test(indexHtml));
  assert(indexHtml.includes('v=20260606-ui-parse-fix'));
  assert(apiJs.includes("API_BASE = '/api/dashboard'"));
  assert(!/localhost:10000|127\.0\.0\.1|http:\/\/localhost/i.test(apiJs));
  assert(!/localhost:10000|127\.0\.0\.1|http:\/\/localhost/i.test(indexHtml));

  const app = express();
  dashboard.registerDashboardRoutes(app, {
    env: config,
    storageManager: { getStorageStatus: () => ({ driver: 'json', redisAvailable: false }) }
  });

  assert(app._router || app.router, 'dashboard route register should not crash');
  console.log('Dashboard env/static tests passed');
}

run();
