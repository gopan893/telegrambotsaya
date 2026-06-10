'use strict';
const assert = require('assert');
const path = require('path');
const ROOT = path.join(__dirname, '..');

async function run() {
  const mod = require(path.join(ROOT, 'src/performance/startup-profiler'));
  const result = await mod.buildStartupPerformanceReport();
  assert.ok(result, 'buildStartupPerformanceReport returns report');
  assert.ok(result.staticCost, 'report has staticCost');
  assert.ok(typeof result.staticCost.totalRequires === 'number', 'staticCost.totalRequires is number');
  assert.ok(Array.isArray(result.staticCost.coreFiles), 'staticCost.coreFiles is array');
  assert.ok(Array.isArray(result.largeFiles), 'report has largeFiles array');
  assert.ok(result.timestamp, 'report has timestamp');
  console.log('PASS: test-startup-profiler — buildStartupPerformanceReport returns report with staticCost stats');
}
run().catch(err => { console.error('FAIL:', err.message); process.exit(1); });
