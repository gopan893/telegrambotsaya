'use strict';
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const ROOT = path.join(__dirname, '..');

async function run() {
  const perfJsPath = path.join(ROOT, 'public/dashboard/performance.js');
  const perfJsExists = fs.existsSync(perfJsPath);
  assert.ok(perfJsExists, 'public/dashboard/performance.js exists');
  if (perfJsExists) {
    const content = fs.readFileSync(perfJsPath, 'utf8');
    assert.ok(content.includes('UI.renderPerformance'), 'performance.js contains UI.renderPerformance');
    assert.ok(content.includes('API'), 'performance.js uses API for data fetching');
  }

  const routesPath = path.join(ROOT, 'src/dashboard/performance-routes.js');
  const routesExists = fs.existsSync(routesPath);
  assert.ok(routesExists, 'src/dashboard/performance-routes.js exists');
  if (routesExists) {
    const routesMod = require(routesPath);
    assert.ok(typeof routesMod.registerPerformanceRoutes === 'function', 'performance-routes.js exports registerPerformanceRoutes');
  }

  console.log('PASS: test-performance-dashboard-api — performance.js exists with UI.renderPerformance, performance-routes.js exports registerPerformanceRoutes');
}
run().catch(err => { console.error('FAIL:', err.message); process.exit(1); });
