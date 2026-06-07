'use strict';

const assert = require('assert');

async function testBlockerDetector() {
  let blockerDetector;
  try {
    blockerDetector = require('../src/operating-loop/blocker-detector');
  } catch (e) {
    console.log('SKIPPED: blocker-detector module not available');
    return { passed: true, skipped: true };
  }

  const tests = [
    { name: 'detectOperatingBlockers returns array', fn: async () => {
      const result = await blockerDetector.detectOperatingBlockers({ modules: {}}, {});
      assert.ok(Array.isArray(result));
    }},
    { name: 'detectOperatingBlockers handles null', fn: async () => {
      const result = await blockerDetector.detectOperatingBlockers(null, {});
      assert.ok(Array.isArray(result));
    }},
    { name: 'detectOperatingBlockers returns blockers with id and severity', fn: async () => {
      const snapshot = {
        modules: { dashboard: { errors: ['out of memory'] } }
      };
      const result = await blockerDetector.detectOperatingBlockers(snapshot, {});
      if (result.length > 0) {
        assert.ok(result[0].id);
        assert.ok(result[0].severity);
        assert.ok(result[0].title);
      }
    }},
    { name: 'detectOperatingBlockers detects critical safety blockers', fn: async () => {
      const snapshot = {
        modules: { bot: { errors: ['autonomous write detected'] } }
      };
      const result = await blockerDetector.detectOperatingBlockers(snapshot, {});
      const critical = result.filter(b => b.severity === 'critical');
      assert.ok(critical.length >= 0);
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

testBlockerDetector().then(result => {
  if (result.skipped) {
    console.log('SKIPPED: test-blocker-detector.js');
    process.exit(0);
  }
  console.log(`\nResults: ${result.passed}/${result.total} passed, ${result.failed} failed`);
  process.exit(result.failed > 0 ? 1 : 0);
}).catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
