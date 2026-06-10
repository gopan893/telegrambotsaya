'use strict';
const assert = require('assert');
const path = require('path');
const ROOT = path.join(__dirname, '..');

async function run() {
  const mod = require(path.join(ROOT, 'src/performance/import-cost-analyzer'));
  const result = await mod.buildImportCostReport();
  assert.ok(result, 'buildImportCostReport returns report');
  assert.ok(result.summary, 'report has summary');
  assert.ok(typeof result.summary.duplicateCount === 'number', 'summary.duplicateCount is number');
  assert.ok(Array.isArray(result.duplicates), 'report has duplicates array');
  assert.ok(Array.isArray(result.recommendations), 'report has recommendations array');
  assert.ok(result.timestamp, 'report has timestamp');
  console.log('PASS: test-import-cost-analyzer — buildImportCostReport returns report with duplicateRequires info');
}
run().catch(err => { console.error('FAIL:', err.message); process.exit(1); });
