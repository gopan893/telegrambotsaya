'use strict';
const assert = require('assert');
const path = require('path');
const ROOT = path.join(__dirname, '..');

async function run() {
  const mod = require(path.join(ROOT, 'src/v2-release/v2-changelog-generator'));
  const changelog = mod.buildHumanReadableV2Changelog({ byPhase: { 'Phase 65': ['Readiness gates'] }, byModule: { release: ['Tooling'] } });
  assert.ok(changelog, 'buildHumanReadableV2Changelog returns changelog');
  assert.ok(changelog.includes('Phase 65'), 'changelog includes phases');

  console.log('PASS: test-v2-changelog-generator — buildHumanReadableV2Changelog returns changelog with phases');
}
run().catch(err => { console.error('FAIL:', err.message); process.exit(1); });
