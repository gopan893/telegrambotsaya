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

  const mod = require(path.join(ROOT, 'src/devices/device-pairing-manager'));

  check(typeof mod.createPairingRequest === 'function', 'createPairingRequest is a function');
  check(typeof mod.approvePairing === 'function', 'approvePairing is a function');
  check(typeof mod.rejectPairing === 'function', 'rejectPairing is a function');
  check(typeof mod.listPairings === 'function', 'listPairings is a function');

  const noDevice = mod.createPairingRequest({});
  check(noDevice.ok === false, 'Missing deviceId rejected');

  const content = fs.readFileSync(path.join(ROOT, 'src/devices/device-pairing-manager.js'), 'utf8');
  check(!content.includes('TELEGRAM_TOKEN'), 'No TELEGRAM_TOKEN in source');
  check(!content.includes('GITHUB_TOKEN'), 'No GITHUB_TOKEN in source');

  console.log('\n--- Device Pairing Manager: ' + passed + ' passed, ' + failed + ' failed ---');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });
