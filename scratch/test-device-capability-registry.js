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

  const mod = require(path.join(ROOT, 'src/devices/device-capability-registry'));

  check(typeof mod.registerCapability === 'function', 'registerCapability is a function');
  check(typeof mod.removeCapability === 'function', 'removeCapability is a function');
  check(typeof mod.listCapabilities === 'function', 'listCapabilities is a function');
  check(typeof mod.getDeviceCapabilities === 'function', 'getDeviceCapabilities is a function');
  check(typeof mod.validateCapability === 'function', 'validateCapability is a function');
  check(typeof mod.listBuiltinCapabilities === 'function', 'listBuiltinCapabilities is a function');

  const result = mod.registerCapability('dev1', { id: 'read_state', label: 'Read' });
  check(result.ok === true, 'Register capability succeeds');

  const caps = mod.getDeviceCapabilities('dev1');
  check(Array.isArray(caps) && caps.length > 0, 'getDeviceCapabilities returns caps');

  const builtin = mod.listBuiltinCapabilities();
  check(Array.isArray(builtin) && builtin.length > 0, 'listBuiltinCapabilities returns array');

  const content = fs.readFileSync(path.join(ROOT, 'src/devices/device-capability-registry.js'), 'utf8');
  check(!content.includes('TELEGRAM_TOKEN'), 'No TELEGRAM_TOKEN in source');
  check(!content.includes('GITHUB_TOKEN'), 'No GITHUB_TOKEN in source');

  console.log('\n--- Device Capability Registry: ' + passed + ' passed, ' + failed + ' failed ---');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });
