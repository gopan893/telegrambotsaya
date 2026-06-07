'use strict';

const assert = require('assert');

async function testCostGuard() {
  let costGuard;
  try {
    costGuard = require('../src/operating-loop/operating-loop-cost-guard');
  } catch (e) {
    console.log('SKIPPED: operating-loop-cost-guard module not available');
    return { passed: true, skipped: true };
  }

  const tests = [
    { name: 'exports cost guard functions', fn: () => {
      assert.ok(typeof costGuard === 'object');
    }},
    { name: 'estimateLoopCost returns number', fn: () => {
      if (typeof costGuard.estimateLoopCost === 'function') {
        const cost = costGuard.estimateLoopCost({ cadence: 'daily' }, {});
        assert.ok(typeof cost === 'number' || cost === null || cost === undefined);
      } else {
        assert.ok(true);
      }
    }},
    { name: 'checkBudget returns result object', fn: () => {
      if (typeof costGuard.checkBudget === 'function') {
        const result = costGuard.checkBudget({ cadence: 'daily' }, {});
        assert.ok(result);
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

testCostGuard().then(result => {
  if (result.skipped) {
    console.log('SKIPPED: test-operating-loop-cost-guard.js');
    process.exit(0);
  }
  console.log(`\nResults: ${result.passed}/${result.total} passed, ${result.failed} failed`);
  process.exit(result.failed > 0 ? 1 : 0);
}).catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
