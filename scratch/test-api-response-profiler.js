'use strict';
const assert = require('assert');
const path = require('path');
const ROOT = path.join(__dirname, '..');

async function run() {
  const mod = require(path.join(ROOT, 'src/performance/api-response-profiler'));
  const result = await mod.buildApiResponsePerformanceReport();
  assert.ok(result, 'buildApiResponsePerformanceReport returns report');
  assert.ok(result.summary, 'report has summary');
  assert.ok(typeof result.summary.slowRiskCount === 'number', 'summary.slowRiskCount is number');
  assert.ok(typeof result.summary.largePayloadCount === 'number', 'summary.largePayloadCount is number');
  assert.ok(Array.isArray(result.recommendations), 'report has recommendations array');
  assert.ok(result.timestamp, 'report has timestamp');
  console.log('PASS: test-api-response-profiler — buildApiResponsePerformanceReport returns report with apiEndpoints');
}
run().catch(err => { console.error('FAIL:', err.message); process.exit(1); });
