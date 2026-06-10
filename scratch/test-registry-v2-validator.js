'use strict';
const assert = require('assert');
const path = require('path');
const ROOT = path.join(__dirname, '..');

async function run() {
  const mod = require(path.join(ROOT, 'src/registry-v2/registry-v2-validator'));
  const result = mod.validateAllRegistriesV2({ dashboardTabs: [], dashboardApis: [], telegramCommands: [], capabilities: [] });
  assert.ok(result, 'validateAllRegistriesV2 returns result');
  assert.ok(typeof result.valid === 'boolean', 'result has valid boolean');
  assert.ok(result.errors, 'result has errors object');
  assert.ok(Array.isArray(result.summary), 'result has summary array');
  console.log('PASS: registry-v2-validator — valid=' + result.valid + ', total issues=' + result.summary.length);
}

run().catch(err => { console.error('FAIL:', err.message); process.exit(1); });
