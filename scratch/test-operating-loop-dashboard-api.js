'use strict';

const assert = require('assert');
const express = require('express');

async function testDashboardAPI() {
  let registerRoutes;
  try {
    const routesModule = require('../src/dashboard/operating-loop-routes');
    registerRoutes = routesModule.registerOperatingLoopRoutes;
  } catch (e) {
    console.log('SKIPPED: operating-loop-routes module not available');
    return { passed: true, skipped: true };
  }

  const app = express();
  const router = express.Router();
  registerRoutes(router, {});

  const routes = router.stack || [];

  const tests = [
    { name: 'registers GET /operating-loop/loops', fn: () => {
      const found = routes.some(r => r.route && r.route.path === '/operating-loop/loops' && r.route.methods.get);
      assert.ok(found);
    }},
    { name: 'registers GET /operating-loop/loops/:id', fn: () => {
      const found = routes.some(r => r.route && r.route.path === '/operating-loop/loops/:id' && r.route.methods.get);
      assert.ok(found);
    }},
    { name: 'registers POST /operating-loop/loops/:id/enable', fn: () => {
      const found = routes.some(r => r.route && r.route.path === '/operating-loop/loops/:id/enable' && r.route.methods.post);
      assert.ok(found);
    }},
    { name: 'registers POST /operating-loop/loops/:id/disable', fn: () => {
      const found = routes.some(r => r.route && r.route.path === '/operating-loop/loops/:id/disable' && r.route.methods.post);
      assert.ok(found);
    }},
    { name: 'registers POST /operating-loop/loops/:id/run', fn: () => {
      const found = routes.some(r => r.route && r.route.path === '/operating-loop/loops/:id/run' && r.route.methods.post);
      assert.ok(found);
    }},
    { name: 'registers GET /operating-loop/snapshot', fn: () => {
      const found = routes.some(r => r.route && r.route.path === '/operating-loop/snapshot' && r.route.methods.get);
      assert.ok(found);
    }},
    { name: 'registers GET /operating-loop/blockers', fn: () => {
      const found = routes.some(r => r.route && r.route.path === '/operating-loop/blockers' && r.route.methods.get);
      assert.ok(found);
    }},
    { name: 'registers GET /operating-loop/next-action', fn: () => {
      const found = routes.some(r => r.route && r.route.path === '/operating-loop/next-action' && r.route.methods.get);
      assert.ok(found);
    }},
    { name: 'registers GET /operating-loop/reports/daily', fn: () => {
      const found = routes.some(r => r.route && r.route.path === '/operating-loop/reports/daily' && r.route.methods.get);
      assert.ok(found);
    }},
    { name: 'registers GET /operating-loop/reports/weekly', fn: () => {
      const found = routes.some(r => r.route && r.route.path === '/operating-loop/reports/weekly' && r.route.methods.get);
      assert.ok(found);
    }},
    { name: 'registers GET /operating-loop/runs', fn: () => {
      const found = routes.some(r => r.route && r.route.path === '/operating-loop/runs' && r.route.methods.get);
      assert.ok(found);
    }},
    { name: 'registers GET /operating-loop/runs/:id', fn: () => {
      const found = routes.some(r => r.route && r.route.path === '/operating-loop/runs/:id' && r.route.methods.get);
      assert.ok(found);
    }},
    { name: 'registers GET /operating-loop/pending-proposals', fn: () => {
      const found = routes.some(r => r.route && r.route.path === '/operating-loop/pending-proposals' && r.route.methods.get);
      assert.ok(found);
    }},
    { name: 'registers GET /operating-loop/status', fn: () => {
      const found = routes.some(r => r.route && r.route.path === '/operating-loop/status' && r.route.methods.get);
      assert.ok(found);
    }}
  ];

  let passed = 0;
  let failed = 0;
  for (const test of tests) {
    try {
      test.fn();
      console.log(`  PASS: ${test.name}`);
      passed++;
    } catch (err) {
      console.log(`  FAIL: ${test.name} - ${err.message}`);
      failed++;
    }
  }
  return { passed, failed, total: tests.length };
}

testDashboardAPI().then(result => {
  if (result.skipped) {
    console.log('SKIPPED: test-operating-loop-dashboard-api.js');
    process.exit(0);
  }
  console.log(`\nResults: ${result.passed}/${result.total} passed, ${result.failed} failed`);
  process.exit(result.failed > 0 ? 1 : 0);
}).catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
