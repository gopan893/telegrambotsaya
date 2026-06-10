'use strict';
const assert = require('assert');
const path = require('path');
const ROOT = path.join(__dirname, '..');

async function run() {
  const mod = require(path.join(ROOT, 'src/v2-planning/v2-risk-register'));
  const result = await mod.buildV2RiskReport();
  assert.ok(result, 'buildV2RiskReport returns result');
  assert.ok(result.data, 'result has data');
  assert.ok(result.data.bySeverity, 'data has bySeverity');
  const allRisks = Object.values(result.data.bySeverity).flatMap(s => s.risks || []);
  assert.ok(Array.isArray(allRisks) && allRisks.length > 0, 'risks array is non-empty');
  console.log('PASS: test-v2-risk-register — buildV2RiskReport returns risks array by severity');
}
run().catch(err => { console.error('FAIL:', err.message); process.exit(1); });
