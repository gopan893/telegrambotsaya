'use strict';
const assert = require('assert');
const path = require('path');
const ROOT = path.join(__dirname, '..');

async function run() {
  const mod = require(path.join(ROOT, 'src/performance/cache-efficiency-auditor'));
  const result = await mod.buildCacheEfficiencyReport();
  assert.ok(result, 'buildCacheEfficiencyReport returns report');
  assert.ok(result.cachePolicy, 'report has cachePolicy');
  assert.ok(typeof result.cachePolicy.hasServiceWorker === 'boolean', 'cachePolicy.hasServiceWorker is boolean');
  assert.ok(Array.isArray(result.staticCacheRules), 'report has staticCacheRules array');
  assert.ok(result.timestamp, 'report has timestamp');
  console.log('PASS: test-cache-efficiency-auditor — buildCacheEfficiencyReport returns report with cachePolicy');
}
run().catch(err => { console.error('FAIL:', err.message); process.exit(1); });
