'use strict';
const assert = require('assert');
const path = require('path');
const ROOT = path.join(__dirname, '..');

async function run() {
  const mod = require(path.join(ROOT, 'src/v2-release/v2-rollback-plan-generator'));
  const plan = mod.generateV2RollbackPlan();
  assert.ok(plan, 'generateV2RollbackPlan returns plan');
  assert.ok(plan.plans, 'plan has plans');
  assert.ok(plan.checklist, 'plan has steps/checklist');

  console.log('PASS: test-v2-rollback-plan-generator — generateV2RollbackPlan returns plan with steps');
}
run().catch(err => { console.error('FAIL:', err.message); process.exit(1); });
