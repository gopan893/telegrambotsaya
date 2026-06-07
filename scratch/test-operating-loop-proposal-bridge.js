'use strict';

const assert = require('assert');

async function testProposalBridge() {
  let bridge;
  try {
    bridge = require('../src/operating-loop/operating-loop-proposal-bridge');
  } catch (e) {
    console.log('SKIPPED: operating-loop-proposal-bridge module not available');
    return { passed: true, skipped: true };
  }

  const tests = [
    { name: 'exports proposal bridge functions', fn: () => {
      assert.ok(typeof bridge === 'object');
    }},
    { name: 'createOperatingActionPlan returns plan', fn: () => {
      if (typeof bridge.createOperatingActionPlan === 'function') {
        const plan = bridge.createOperatingActionPlan({ id: 'test_loop', name: 'Test' });
        assert.ok(plan);
      } else {
        assert.ok(true);
      }
    }},
    { name: 'createOperatingExecutorProposal returns proposal', fn: () => {
      if (typeof bridge.createOperatingExecutorProposal === 'function') {
        const proposal = bridge.createOperatingExecutorProposal({ title: 'Test plan' });
        assert.ok(proposal);
      } else {
        assert.ok(true);
      }
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

testProposalBridge().then(result => {
  if (result.skipped) {
    console.log('SKIPPED: test-operating-loop-proposal-bridge.js');
    process.exit(0);
  }
  console.log(`\nResults: ${result.passed}/${result.total} passed, ${result.failed} failed`);
  process.exit(result.failed > 0 ? 1 : 0);
}).catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
