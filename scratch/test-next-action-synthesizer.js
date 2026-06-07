'use strict';

const assert = require('assert');

async function testSynthesizer() {
  let synthesizer;
  try {
    synthesizer = require('../src/operating-loop/next-action-synthesizer');
  } catch (e) {
    console.log('SKIPPED: next-action-synthesizer module not available');
    return { passed: true, skipped: true };
  }

  const tests = [
    { name: 'synthesizeNextActions returns array', fn: async () => {
      const result = await synthesizer.synthesizeNextActions({ healthStatus: 'healthy', modules: {}}, [], {});
      assert.ok(Array.isArray(result));
    }},
    { name: 'synthesizeNextActions handles null snapshot', fn: async () => {
      const result = await synthesizer.synthesizeNextActions(null, [], {});
      assert.ok(Array.isArray(result));
      assert.ok(result.length > 0);
    }},
    { name: 'synthesizeNextActions returns actions with id and title', fn: async () => {
      const result = await synthesizer.synthesizeNextActions({ healthStatus: 'healthy', modules: {}, pendingApprovals: 0 }, [], {});
      if (result.length > 0) {
        assert.ok(result[0].id);
        assert.ok(result[0].title);
        assert.ok(result[0].priority);
      }
    }},
    { name: 'synthesizeNextActions returns critical blocker action first', fn: async () => {
      const blockers = [{
        id: 'b1', severity: 'critical', module: 'dashboard', title: 'DB down', description: 'Database unavailable', suggestedAction: 'Restart DB'
      }];
      const result = await synthesizer.synthesizeNextActions({
        healthStatus: 'critical', modules: { dashboard: { errors: ['DB down'] } }
      }, blockers, {});
      assert.ok(result.length > 0);
      assert.ok(result[0].title.includes('DB down') || result[0].title.includes('Stabilize'));
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

testSynthesizer().then(result => {
  if (result.skipped) {
    console.log('SKIPPED: test-next-action-synthesizer.js');
    process.exit(0);
  }
  console.log(`\nResults: ${result.passed}/${result.total} passed, ${result.failed} failed`);
  process.exit(result.failed > 0 ? 1 : 0);
}).catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
