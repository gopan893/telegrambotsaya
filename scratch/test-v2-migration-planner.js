'use strict';
const assert = require('assert');
const path = require('path');
const ROOT = path.join(__dirname, '..');

async function run() {
  const mod = require(path.join(ROOT, 'src/v2-planning/v2-migration-planner'));
  const result = await mod.createV2MigrationPlan();
  assert.ok(result, 'createV2MigrationPlan returns result');
  assert.ok(result.data, 'result has data');
  assert.ok(Array.isArray(result.data.steps), 'data.steps is array');
  assert.ok(result.data.steps.length > 0, 'data.steps has items');
  assert.ok(result.data.risks, 'data has risks');
  assert.ok(result.data.compatibility, 'data has compatibility');
  assert.ok(result.data.rollback, 'data has rollback');
  console.log('PASS: test-v2-migration-planner — createV2MigrationPlan returns plan with phases/steps array');
}
run().catch(err => { console.error('FAIL:', err.message); process.exit(1); });
