'use strict';

const express = require('express');
const http = require('http');
const { registerDashboardRoutes } = require('../src/dashboard/dashboard-routes');

async function runTests() {
  const app = express();
  app.use(express.json());

  const mockEnv = {
    DASHBOARD_ENABLED: 'true',
    DASHBOARD_ADMIN_TOKEN: 'super-secure-token-123',
    DATABASE_URL: 'postgresql://postgres:secretpassword@localhost:5432/db',
    TELEGRAM_TOKEN: '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11'
  };

  const mockServices = {
    env: mockEnv,
    storageManager: {
      getStorageStatus: () => ({
        driver: 'postgres',
        redisAvailable: true
      })
    },
    opsSystem: {
      getStatus: () => ({
        health: { status: 'healthy', issues: [] },
        telemetry: {
          counters: { request: 42 },
          recentErrorCount: 0,
          anomalyScore: 0,
          latency: { p50: 10, p90: 25, max: 100 }
        },
        reliability: { score: 0.98, status: 'stable' }
      })
    }
  };

  registerDashboardRoutes(app, mockServices);

  // Start server on a random port
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;
  console.log(`Test server running on ${baseUrl}`);

  let testCount = 0;
  let passCount = 0;

  function assert(condition, message) {
    testCount++;
    if (condition) {
      passCount++;
      console.log(`[PASS] ${message}`);
    } else {
      console.error(`[FAIL] ${message}`);
    }
  }

  try {
    // 1. Health endpoint (Public)
    const healthRes = await fetch(`${baseUrl}/api/dashboard/health`);
    const healthData = await healthRes.json();
    assert(healthRes.status === 200, 'GET /api/dashboard/health returns 200');
    assert(healthData.ok === true, 'GET /api/dashboard/health returns ok:true');
    assert(healthData.dashboardEnabled === true, 'GET /api/dashboard/health returns correct status');

    // 2. Summary endpoint without token (Blocked)
    const summaryBlockedRes = await fetch(`${baseUrl}/api/dashboard/summary`);
    assert(summaryBlockedRes.status === 401, 'GET /api/dashboard/summary without token returns 401');

    // 3. Summary endpoint with wrong token (Blocked)
    const summaryWrongRes = await fetch(`${baseUrl}/api/dashboard/summary`, {
      headers: { 'Authorization': 'Bearer wrong-token' }
    });
    assert(summaryWrongRes.status === 401, 'GET /api/dashboard/summary with wrong token returns 401');

    // 4. Summary endpoint with correct token (Allowed & Sanitized)
    const summaryAllowedRes = await fetch(`${baseUrl}/api/dashboard/summary`, {
      headers: { 'Authorization': 'Bearer super-secure-token-123' }
    });
    const summaryData = await summaryAllowedRes.json();
    assert(summaryAllowedRes.status === 200, 'GET /api/dashboard/summary with correct token returns 200');
    
    // Check that secrets are NOT leaked
    const rawDataString = JSON.stringify(summaryData);
    assert(!rawDataString.includes('secretpassword'), 'Database secrets are masked from JSON response');
    assert(!rawDataString.includes('ABC-DEF1234ghIkl'), 'Telegram tokens are masked from JSON response');
    assert(!rawDataString.includes('super-secure-token-123'), 'Admin token itself is masked from JSON response');
    console.log('Sanitized Response Example:', summaryData);

    // 5. Check action endpoint protection & rate limiting
    let rateLimited = false;
    for (let i = 0; i < 12; i++) {
      const res = await fetch(`${baseUrl}/api/dashboard/actions/ops/refresh`, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer super-secure-token-123' }
      });
      if (res.status === 429) {
        rateLimited = true;
        break;
      }
    }
    assert(rateLimited === true, 'POST /api/dashboard/actions/... rate limits at 10 requests/minute');

  } catch (err) {
    console.error('Test run error:', err);
  } finally {
    server.close();
    console.log(`\nTests completed. Passed: ${passCount}/${testCount}`);
    process.exit(passCount === testCount ? 0 : 1);
  }
}

runTests();
