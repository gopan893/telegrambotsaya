'use strict';
const assert = require('assert');
const path = require('path');
const ROOT = path.join(__dirname, '..');

async function run() {
  const mod = require(path.join(ROOT, 'src/v2-release/v2-readiness-gate'));
  const rcMod = require(path.join(ROOT, 'src/v2-release/v2-release-candidate-manager'));
  const input = { workspaceId: 'ws-readiness', version: 'v2.0.0-rc.2' };
  const candidate = rcMod.createV2ReleaseCandidate(input);
  const results = mod.runV2ReadinessGate(candidate.id);
  assert.ok(results, 'runV2ReadinessGate returns results');
  assert.ok(results.results, 'results has readiness checks');

  console.log('PASS: test-v2-readiness-gate — runV2ReadinessGate returns results with readiness checks');
}
run().catch(err => { console.error('FAIL:', err.message); process.exit(1); });
