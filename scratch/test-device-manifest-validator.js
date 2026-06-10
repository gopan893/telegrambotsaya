'use strict';
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const ROOT = path.join(__dirname, '..');

async function run() {
  let passed = 0;
  let failed = 0;
  const failures = [];

  function check(ok, msg) {
    if (ok) { console.log('PASS: ' + msg); passed++; }
    else { console.log('FAIL: ' + msg); failed++; failures.push(msg); }
  }

  const mod = require(path.join(ROOT, 'src/devices/device-manifest-validator'));

  check(typeof mod.validateManifest === 'function', 'validateManifest is a function');
  check(typeof mod.checkUnsafePatterns === 'function', 'checkUnsafePatterns is a function');
  check(typeof mod.checkBlockedFields === 'function', 'checkBlockedFields is a function');
  check(typeof mod.validateDeviceManifest === 'function', 'validateDeviceManifest is a function');

  const valid = mod.validateManifest({ id: 'test', name: 'Test' });
  check(valid.valid === true, 'Valid manifest passes');
  check(valid.errors.length === 0, 'Valid manifest has no errors');

  const invalid = mod.validateManifest(null);
  check(invalid.valid === false, 'Null manifest fails');

  const unsafe = mod.checkUnsafePatterns({ exec: true });
  check(typeof unsafe === 'object', 'checkUnsafePatterns returns object');

  const blocked = mod.checkBlockedFields({ shell: true });
  check(typeof blocked === 'object', 'checkBlockedFields returns object');

  const full = mod.validateDeviceManifest({ id: 'test', name: 'Test' });
  check(typeof full === 'object' && typeof full.valid === 'boolean', 'validateDeviceManifest returns result');

  const content = fs.readFileSync(path.join(ROOT, 'src/devices/device-manifest-validator.js'), 'utf8');
  check(!content.includes('TELEGRAM_TOKEN'), 'No TELEGRAM_TOKEN in source');
  check(!content.includes('GITHUB_TOKEN'), 'No GITHUB_TOKEN in source');

  console.log('\n--- Device Manifest Validator: ' + passed + ' passed, ' + failed + ' failed ---');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });
