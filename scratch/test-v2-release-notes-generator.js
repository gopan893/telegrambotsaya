'use strict';
const assert = require('assert');
const path = require('path');
const ROOT = path.join(__dirname, '..');

async function run() {
  const mod = require(path.join(ROOT, 'src/v2-release/v2-release-notes-generator'));
  const rcMod = require(path.join(ROOT, 'src/v2-release/v2-release-candidate-manager'));
  const input = { workspaceId: 'ws-notes', version: 'v2.0.0-rc.3' };
  const candidate = rcMod.createV2ReleaseCandidate(input);
  const notes = mod.generateV2ReleaseNotes(candidate.id);
  assert.ok(notes, 'generateV2ReleaseNotes returns notes');
  assert.ok(notes.includes('Version'), 'notes has version info');

  console.log('PASS: test-v2-release-notes-generator — generateV2ReleaseNotes returns notes with version info');
}
run().catch(err => { console.error('FAIL:', err.message); process.exit(1); });
