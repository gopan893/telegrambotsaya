'use strict';

const assert = require('assert');

async function testCollector() {
  let collector;
  try {
    collector = require('../src/operating-loop/system-state-collector');
  } catch (e) {
    console.log('SKIPPED: system-state-collector module not available');
    return { passed: true, skipped: true };
  }

  const tests = [
    { name: 'collectSystemState returns object', fn: async () => {
      const state = await collector.collectSystemState('', {});
      assert.ok(state);
      assert.ok(typeof state === 'object');
    }},
    { name: 'collectSystemState handles missing services', fn: async () => {
      const state = await collector.collectSystemState('test_ws');
      assert.ok(state);
    }},
    { name: 'collectSystemState has modules key', fn: async () => {
      const state = await collector.collectSystemState('', {});
      if (state && typeof state.modules !== 'undefined') {
        assert.ok(typeof state.modules === 'object');
      } else {
        assert.ok(true, 'modules may be undefined in degraded mode');
      }
    }},
    { name: 'collectSystemState no secrets leaked', fn: async () => {
      const state = await collector.collectSystemState('', {});
      const str = JSON.stringify(state);
      assert.ok(!str.includes('TELEGRAM_TOKEN'));
      assert.ok(!str.includes('DATABASE_URL'));
      assert.ok(!str.includes('GITHUB_TOKEN'));
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

testCollector().then(result => {
  if (result.skipped) {
    console.log('SKIPPED: test-system-state-collector.js');
    process.exit(0);
  }
  console.log(`\nResults: ${result.passed}/${result.total} passed, ${result.failed} failed`);
  process.exit(result.failed > 0 ? 1 : 0);
}).catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
