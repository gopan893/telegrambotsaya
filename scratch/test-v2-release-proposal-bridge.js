'use strict';
const assert = require('assert');
const path = require('path');
const ROOT = path.join(__dirname, '..');

async function run() {
  const mod = require(path.join(ROOT, 'src/v2-release/v2-release-proposal-bridge'));
  const rcMod = require(path.join(ROOT, 'src/v2-release/v2-release-candidate-manager'));
  const input = { workspaceId: 'ws-proposal', version: 'v2.0.0-rc.4' };
  const candidate = rcMod.createV2ReleaseCandidate(input);
  const plan = mod.createV2ReleaseActionPlan(candidate.id);
  assert.ok(plan, 'createV2ReleaseActionPlan returns action plan');
  assert.ok(plan.proposals, 'plan has proposals');

  console.log('PASS: test-v2-release-proposal-bridge — createV2ReleaseActionPlan returns action plan with proposal');
}
run().catch(err => { console.error('FAIL:', err.message); process.exit(1); });
