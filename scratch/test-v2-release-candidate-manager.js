'use strict';
const assert = require('assert');
const path = require('path');
const ROOT = path.join(__dirname, '..');

async function run() {
  const mod = require(path.join(ROOT, 'src/v2-release/v2-release-candidate-manager'));
  const input = { workspaceId: 'ws-test', version: 'v2.0.0-rc.1' };
  const candidate = mod.createV2ReleaseCandidate(input);
  assert.ok(candidate, 'createV2ReleaseCandidate returns candidate');
  assert.ok(candidate.id, 'candidate has id');
  assert.ok(candidate.version, 'candidate has version');

  const status = mod.getV2ReleaseCandidateStatus(candidate.id);
  assert.ok(status, 'getV2ReleaseCandidateStatus returns status');
  assert.ok(status.status, 'status has status field');

  console.log('PASS: test-v2-release-candidate-manager — createV2ReleaseCandidate returns candidate with id and version; getV2ReleaseCandidateStatus returns status');
}
run().catch(err => { console.error('FAIL:', err.message); process.exit(1); });
