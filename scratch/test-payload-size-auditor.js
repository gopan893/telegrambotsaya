'use strict';
const assert = require('assert');
const path = require('path');
const ROOT = path.join(__dirname, '..');

async function run() {
  const mod = require(path.join(ROOT, 'src/performance/payload-size-auditor'));
  const result = await mod.buildPayloadSizeReport();
  assert.ok(result, 'buildPayloadSizeReport returns report');
  assert.ok(result.summary, 'report has summary');
  assert.ok(Array.isArray(result.recommendations), 'report has recommendations array');
  assert.ok(result.timestamp, 'report has timestamp');
  console.log('PASS: test-payload-size-auditor — buildPayloadSizeReport returns report with recommendations');
}
run().catch(err => { console.error('FAIL:', err.message); process.exit(1); });
