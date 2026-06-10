'use strict';
const assert = require('assert');
const path = require('path');
const ROOT = path.join(__dirname, '..');

async function run() {
  const mod = require(path.join(ROOT, 'src/v2-planning/v2-architecture-principles'));
  const result = await mod.buildPrinciplesReport();
  assert.ok(result, 'buildPrinciplesReport returns result');
  assert.ok(result.data, 'result has data');
  assert.ok(result.data.bySeverity, 'data has bySeverity');
  const allPrinciples = Object.values(result.data.bySeverity).flatMap(s => s.principles || []);
  assert.ok(Array.isArray(allPrinciples) && allPrinciples.length > 0, 'principles array is non-empty');
  console.log('PASS: test-v2-architecture-principles — buildPrinciplesReport returns principles by severity');
}
run().catch(err => { console.error('FAIL:', err.message); process.exit(1); });
