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

  const mod = require(path.join(ROOT, 'src/plugin-hardening/plugin-permission-versioning'));

  check(typeof mod.createPermissionVersion === 'function', 'createPermissionVersion is a function');
  check(typeof mod.bumpPermissionVersion === 'function', 'bumpPermissionVersion is a function');
  check(typeof mod.detectEscalation === 'function', 'detectEscalation is a function');
  check(typeof mod.detectPermissionDrift === 'function', 'detectPermissionDrift is a function');
  check(typeof mod.summarizePermissions === 'function', 'summarizePermissions is a function');
  check(typeof mod.checkPermissionConsistency === 'function', 'checkPermissionConsistency is a function');

  const pv = mod.createPermissionVersion('test-plugin', ['read', 'write']);
  check(pv.pluginId === 'test-plugin', 'createPermissionVersion sets pluginId');
  check(pv.version === 1, 'Initial version is 1');
  check(pv.permissions.length === 2, 'Permissions array has 2 entries');

  const bumped = mod.bumpPermissionVersion(pv, ['read', 'write', 'admin'], 'added admin');
  check(bumped.version === 2, 'Bumped version is 2');
  check(bumped.permissions.includes('admin'), 'New permissions include admin');
  check(bumped.history.length === 2, 'History has 2 entries');

  const escalation = mod.detectEscalation(['read'], ['read', 'shell']);
  check(escalation.hasEscalation === true, 'Detects permission escalation');
  check(Array.isArray(escalation.added), 'Escalation reports new permissions');

  const noEscalation = mod.detectEscalation(['read', 'write'], ['read']);
  check(noEscalation.hasEscalation === false, 'No escalation when removing permissions');

  const summary = mod.summarizePermissions(['read', 'write', 'shell', 'admin']);
  check(typeof summary === 'object', 'summarizePermissions returns object');

  const content = fs.readFileSync(path.join(ROOT, 'src/plugin-hardening/plugin-permission-versioning.js'), 'utf8');
  check(!content.includes('TELEGRAM_TOKEN'), 'No TELEGRAM_TOKEN in source');
  check(!content.includes('GITHUB_TOKEN'), 'No GITHUB_TOKEN in source');

  console.log('\n--- Plugin Permission Versioning: ' + passed + ' passed, ' + failed + ' failed ---');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });
