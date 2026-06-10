'use strict';
const assert = require('assert');
const path = require('path');
const ROOT = path.join(__dirname, '..');

async function run() {
  const mod = require(path.join(ROOT, 'src/v2-release/v2-upgrade-guide-generator'));
  const guide = mod.generateV2UpgradeGuide();
  assert.ok(guide, 'generateV2UpgradeGuide returns guide');
  assert.ok(guide.includes('## Environment Changes'), 'guide has sections');

  console.log('PASS: test-v2-upgrade-guide-generator — generateV2UpgradeGuide returns guide string/object with sections');
}
run().catch(err => { console.error('FAIL:', err.message); process.exit(1); });
