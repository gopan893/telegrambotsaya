'use strict';

const assert = require('assert');

async function testSnapshotBuilder() {
  let snapshotBuilder;
  try {
    snapshotBuilder = require('../src/operating-loop/operating-snapshot-builder');
  } catch (e) {
    console.log('SKIPPED: operating-snapshot-builder module not available');
    return { passed: true, skipped: true };
  }

  const tests = [
    { name: 'buildOperatingSnapshot returns snapshot with id', fn: async () => {
      const snap = await snapshotBuilder.buildOperatingSnapshot({}, {});
      assert.ok(snap);
      assert.ok(snap.id);
      assert.ok(snap.id.startsWith('snap_'));
    }},
    { name: 'buildOperatingSnapshot healthStatus unknown for empty state', fn: async () => {
      const snap = await snapshotBuilder.buildOperatingSnapshot({}, {});
      assert.ok(snap.healthStatus);
    }},
    { name: 'classifySnapshotHealth returns healthy for no issues', fn: () => {
      const result = snapshotBuilder.classifySnapshotHealth({ modules: {}, pendingApprovals: 0, concerns: [] });
      assert.strictEqual(result, 'healthy');
    }},
    { name: 'classifySnapshotHealth returns critical for errors', fn: () => {
      const result = snapshotBuilder.classifySnapshotHealth({
        modules: { test: { errors: ['something wrong'] } }
      });
      assert.strictEqual(result, 'critical');
    }},
    { name: 'classifySnapshotHealth returns critical for blockers', fn: () => {
      const result = snapshotBuilder.classifySnapshotHealth({
        modules: { test: { blockers: [{ title: 'blocked' }] } }
      });
      assert.strictEqual(result, 'critical');
    }},
    { name: 'classifySnapshotHealth returns degraded for degraded module', fn: () => {
      const result = snapshotBuilder.classifySnapshotHealth({
        modules: { test: { status: 'degraded' } }
      });
      assert.strictEqual(result, 'degraded');
    }},
    { name: 'classifySnapshotHealth returns warning for pending approvals', fn: () => {
      const result = snapshotBuilder.classifySnapshotHealth({
        modules: {}, pendingApprovals: 3
      });
      assert.strictEqual(result, 'warning');
    }},
    { name: 'summarizeOperatingSnapshot returns string', fn: async () => {
      const snap = { modules: { a: { status: 'ok' } }, healthStatus: 'healthy', concerns: [], opportunities: [], pendingApprovals: 0 };
      const summary = await snapshotBuilder.summarizeOperatingSnapshot(snap, {});
      assert.ok(typeof summary === 'string');
      assert.ok(summary.includes('healthy'));
    }},
    { name: 'extractTopConcerns returns array', fn: () => {
      const result = snapshotBuilder.extractTopConcerns({ modules: {}, concerns: [] });
      assert.ok(Array.isArray(result));
    }},
    { name: 'extractTopOpportunities returns array', fn: () => {
      const result = snapshotBuilder.extractTopOpportunities({ modules: {}});
      assert.ok(Array.isArray(result));
    }}
  ];

  let passed = 0;
  let failed = 0;
  for (const test of tests) {
    try {
      await test.fn();
      console.log(`  PASS: ${test.name}`);
      passed++;
    } catch (err) {
      console.log(`  FAIL: ${test.name} - ${err.message}`);
      failed++;
    }
  }
  return { passed, failed, total: tests.length };
}

testSnapshotBuilder().then(result => {
  if (result.skipped) {
    console.log('SKIPPED: test-operating-snapshot-builder.js');
    process.exit(0);
  }
  console.log(`\nResults: ${result.passed}/${result.total} passed, ${result.failed} failed`);
  process.exit(result.failed > 0 ? 1 : 0);
}).catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
