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

  const mod = require(path.join(ROOT, 'src/devices/device-registry'));

  check(typeof mod.createDevice === 'function', 'createDevice is a function');
  check(typeof mod.registerDevice === 'function', 'registerDevice is a function');
  check(typeof mod.getDevice === 'function', 'getDevice is a function');
  check(typeof mod.listDevices === 'function', 'listDevices is a function');
  check(typeof mod.updateDevice === 'function', 'updateDevice is a function');
  check(typeof mod.removeDevice === 'function', 'removeDevice is a function');
  check(typeof mod.validateRegistry === 'function', 'validateRegistry is a function');
  check(typeof mod.getRegistryStats === 'function', 'getRegistryStats is a function');

  const result = mod.createDevice({ name: 'Test Device', type: 'android_termux' });
  check(result.ok === true, 'Create device succeeds');
  check(result.device && result.device.id, 'Created device has id');
  check(result.device.name === 'Test Device', 'Created device has correct name');

  const invalid = mod.createDevice({ name: 'Bad' });
  check(invalid.ok === false, 'Invalid device type rejected');

  const found = mod.getDevice(result.device.id);
  check(found !== null, 'getDevice returns created device');

  const list = mod.listDevices();
  check(Array.isArray(list) && list.length > 0, 'listDevices returns array');

  const stats = mod.getRegistryStats();
  check(typeof stats === 'object' && typeof stats.total === 'number', 'getRegistryStats returns stats');

  const validation = mod.validateRegistry();
  check(typeof validation === 'object' && typeof validation.valid === 'boolean', 'validateRegistry returns result');

  const content = fs.readFileSync(path.join(ROOT, 'src/devices/device-registry.js'), 'utf8');
  check(!content.includes('TELEGRAM_TOKEN'), 'No TELEGRAM_TOKEN in source');
  check(!content.includes('GITHUB_TOKEN'), 'No GITHUB_TOKEN in source');

  console.log('\n--- Device Registry: ' + passed + ' passed, ' + failed + ' failed ---');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });
