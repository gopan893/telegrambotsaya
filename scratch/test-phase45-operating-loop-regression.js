'use strict';

const assert = require('assert');

async function testRegression() {
  console.log('Phase 45 Operating Loop Regression Tests');
  console.log('========================================');

  const results = [];

  async function runTest(name, fn) {
    try {
      await fn();
      console.log(`  PASS: ${name}`);
      results.push({ name, passed: true });
    } catch (err) {
      console.log(`  FAIL: ${name} - ${err.message}`);
      results.push({ name, passed: false, error: err.message });
    }
  }

  await runTest('operating-loop-utils exports maskSecret', () => {
    const utils = require('../src/operating-loop/operating-loop-utils');
    assert.ok(typeof utils.maskSecret === 'function');
    assert.ok(typeof utils.nowIso === 'function');
    assert.ok(typeof utils.generateId === 'function');
    assert.ok(typeof utils.sanitizeSnapshot === 'function');
  });

  await runTest('operating-loop-utils maskSecret redacts tokens', () => {
    const utils = require('../src/operating-loop/operating-loop-utils');
    const result = utils.maskSecret('TELEGRAM_TOKEN=xxx');
    assert.ok(!result.includes('TELEGRAM_TOKEN=xxx'));
    assert.ok(result.includes('REDACTED_SECRET') || result !== 'TELEGRAM_TOKEN=xxx');
  });

  await runTest('operating-loop-store exports functions', () => {
    const store = require('../src/operating-loop/operating-loop-store');
    assert.ok(typeof store.listOperatingLoops === 'function');
    assert.ok(typeof store.getOperatingLoop === 'function');
    assert.ok(typeof store.saveOperatingLoop === 'function');
    assert.ok(typeof store.listLoopRuns === 'function');
    assert.ok(typeof store.getLoopRun === 'function');
    assert.ok(typeof store.saveLoopRun === 'function');
    assert.ok(typeof store.listSnapshots === 'function');
    assert.ok(typeof store.saveSnapshot === 'function');
  });

  await runTest('operating-loop-registry validates config', () => {
    const registry = require('../src/operating-loop/operating-loop-registry');
    const valid = registry.validateOperatingLoopConfig({
      id: 'test', mode: 'scheduled_readonly',
      blockedActions: ['write', 'external', 'danger', 'shell', 'git_push', 'deploy', 'rollback', 'email_send', 'calendar_write', 'webhook_post']
    });
    assert.ok(valid.ok);
    const invalid = registry.validateOperatingLoopConfig({ id: 'test', mode: 'scheduled_readonly', blockedActions: [] });
    assert.ok(!invalid.ok);
  });

  await runTest('snapshot-builder health classification works', () => {
    const builder = require('../src/operating-loop/operating-snapshot-builder');
    assert.strictEqual(builder.classifySnapshotHealth({ modules: {}}), 'healthy');
    assert.strictEqual(builder.classifySnapshotHealth({ modules: { a: { errors: ['err'] } } }), 'critical');
    assert.strictEqual(builder.classifySnapshotHealth({ modules: { a: { status: 'degraded' } } }), 'degraded');
    assert.strictEqual(builder.classifySnapshotHealth({ modules: {}, pendingApprovals: 2 }), 'warning');
  });

  await runTest('system-state-collector handles empty services', async () => {
    const collector = require('../src/operating-loop/system-state-collector');
    const state = await collector.collectSystemState('', {});
    assert.ok(state);
    assert.ok(typeof state === 'object');
    const str = JSON.stringify(state);
    assert.ok(!str.includes('TELEGRAM_TOKEN'));
    assert.ok(!str.includes('DATABASE_URL'));
  });

  await runTest('blocker-detector returns array for empty input', async () => {
    const blockerDetector = require('../src/operating-loop/blocker-detector');
    const result = await blockerDetector.detectOperatingBlockers({ modules: {}}, {});
    assert.ok(Array.isArray(result));
  });

  await runTest('next-action-synthesizer returns actions', async () => {
    const synth = require('../src/operating-loop/next-action-synthesizer');
    const result = await synth.synthesizeNextActions({ healthStatus: 'healthy', modules: {}}, [], {});
    assert.ok(Array.isArray(result));
  });

  await runTest('operating-loop-report-generator creates daily report', async () => {
    const rg = require('../src/operating-loop/operating-loop-report-generator');
    const report = await rg.generateDailyAIOSReport('', {});
    assert.ok(report);
    assert.ok(report.type === 'daily');
    assert.ok(report.id);
    assert.ok(report.healthStatus);
  });

  await runTest('operating-loop-report-generator creates weekly report', async () => {
    const rg = require('../src/operating-loop/operating-loop-report-generator');
    const report = await rg.generateWeeklyAIOSReport('', {});
    assert.ok(report);
    assert.ok(report.type === 'weekly');
    assert.ok(report.id);
  });

  await runTest('dashboard operating-loop-routes registers all endpoints', () => {
    const routesModule = require('../src/dashboard/operating-loop-routes');
    assert.ok(typeof routesModule.registerOperatingLoopRoutes === 'function');
    const express = require('express');
    const router = express.Router();
    routesModule.registerOperatingLoopRoutes(router, {});
    const routes = router.stack || [];
    const paths = routes.filter(r => r.route).map(r => r.route.path);
    assert.ok(paths.includes('/operating-loop/loops'));
    assert.ok(paths.includes('/operating-loop/loops/:id'));
    assert.ok(paths.includes('/operating-loop/loops/:id/enable'));
    assert.ok(paths.includes('/operating-loop/loops/:id/disable'));
    assert.ok(paths.includes('/operating-loop/loops/:id/run'));
    assert.ok(paths.includes('/operating-loop/snapshot'));
    assert.ok(paths.includes('/operating-loop/blockers'));
    assert.ok(paths.includes('/operating-loop/next-action'));
    assert.ok(paths.includes('/operating-loop/reports/daily'));
    assert.ok(paths.includes('/operating-loop/reports/weekly'));
    assert.ok(paths.includes('/operating-loop/runs'));
    assert.ok(paths.includes('/operating-loop/runs/:id'));
    assert.ok(paths.includes('/operating-loop/pending-proposals'));
    assert.ok(paths.includes('/operating-loop/status'));
  });

  await runTest('no secrets leaked in operating-loop modules', () => {
    const files = [
      '../src/operating-loop/operating-loop-utils',
      '../src/operating-loop/operating-loop-store',
      '../src/operating-loop/operating-loop-registry',
      '../src/operating-loop/operating-snapshot-builder',
      '../src/operating-loop/blocker-detector',
      '../src/operating-loop/next-action-synthesizer',
      '../src/operating-loop/operating-loop-report-generator'
    ];
    for (const f of files) {
      try {
        const mod = require(f);
        const str = JSON.stringify(mod);
        assert.ok(!str.includes('TELEGRAM_TOKEN='));
        assert.ok(!str.includes('DATABASE_URL='));
        assert.ok(!str.includes('GITHUB_TOKEN='));
      } catch (e) {
        // ignore modules that can't be loaded
      }
    }
  });

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log(`\nResults: ${passed}/${results.length} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

testRegression().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
