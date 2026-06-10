'use strict';
const assert = require('assert');
const path = require('path');
const ROOT = path.join(__dirname, '..');

async function run() {
  const mod = require(path.join(ROOT, 'src/performance/performance-scorecard'));
  const result = await mod.calculatePerformanceScorecard();
  assert.ok(result, 'calculatePerformanceScorecard returns scorecard');
  assert.ok(typeof result.overall === 'number', 'scorecard has overallScore');
  assert.ok(typeof result.dashboard === 'number', 'scorecard has dashboard score');
  assert.ok(typeof result.startup === 'number', 'scorecard has startup score');
  assert.ok(typeof result.api === 'number', 'scorecard has api score');
  assert.ok(typeof result.pwa === 'number', 'scorecard has pwa score');
  assert.ok(result.timestamp, 'scorecard has timestamp');
  console.log('PASS: test-performance-scorecard — calculatePerformanceScorecard returns scorecard with overallScore');
}
run().catch(err => { console.error('FAIL:', err.message); process.exit(1); });
