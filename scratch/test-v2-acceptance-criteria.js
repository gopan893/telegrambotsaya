'use strict';
const assert = require('assert');
const path = require('path');
const ROOT = path.join(__dirname, '..');

async function run() {
  const mod = require(path.join(ROOT, 'src/v2-planning/v2-acceptance-criteria'));
  const result = await mod.defineV2AcceptanceCriteria();
  assert.ok(result, 'defineV2AcceptanceCriteria returns result');
  assert.ok(result.data, 'result has data');
  assert.ok(Array.isArray(result.data.all), 'data.all is array');
  assert.ok(result.data.all.length > 0, 'data.all has items');
  assert.ok(result.data.registryNormalization, 'data has registryNormalization');
  assert.ok(result.data.dashboard, 'data has dashboard');
  assert.ok(result.data.safetyBoundary, 'data has safetyBoundary');
  assert.ok(result.data.performance, 'data has performance');
  assert.ok(result.data.docsTest, 'data has docsTest');
  console.log('PASS: test-v2-acceptance-criteria — defineV2AcceptanceCriteria returns criteria array');
}
run().catch(err => { console.error('FAIL:', err.message); process.exit(1); });
