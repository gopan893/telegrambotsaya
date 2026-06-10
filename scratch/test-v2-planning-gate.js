'use strict';
const assert = require('assert');
const path = require('path');
const ROOT = path.join(__dirname, '..');

async function run() {
  const mod = require(path.join(ROOT, 'src/v2-planning/v2-planning-gate'));
  const result = await mod.runV2PlanningGate();
  assert.ok(result, 'runV2PlanningGate returns result');
  assert.ok(result.hasOwnProperty('passed'), 'result has passed');
  assert.ok(result.hasOwnProperty('status'), 'result has status');
  assert.ok(result.hasOwnProperty('score'), 'result has score');
  assert.ok(result.hasOwnProperty('gate'), 'result has gate');
  console.log('PASS: test-v2-planning-gate — runV2PlanningGate returns passed/status/score/gate object');
}
run().catch(err => { console.error('FAIL:', err.message); process.exit(1); });
