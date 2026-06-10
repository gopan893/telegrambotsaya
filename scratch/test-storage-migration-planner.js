'use strict';
const assert = require('assert');
const path = require('path');
const ROOT = path.join(__dirname, '..');

async function run() {
  const mod = require(path.join(ROOT, 'src/boundary/storage-migration-planner'));
  const plan = mod.createStorageMigrationPlan({ from: 'redis', to: 'postgres', module: 'test' });
  assert.ok(plan, 'createStorageMigrationPlan should return a plan');
  assert.ok(Array.isArray(plan.steps), 'plan should have steps array');
  assert.ok(plan.steps.length > 0, 'plan steps should not be empty');
  console.log('PASS: test-storage-migration-planner — createStorageMigrationPlan returns plan with steps');
}
run().catch(err => { console.error('FAIL:', err.message); process.exit(1); });
