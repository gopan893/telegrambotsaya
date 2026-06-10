'use strict';
const assert = require('assert');
const path = require('path');
const ROOT = path.join(__dirname, '..');

async function run() {
  const mod = require(path.join(ROOT, 'src/registry-v2/registry-v2-normalizer'));
  const result = mod.normalizeAllRegistriesV2();
  assert.ok(result, 'normalizeAllRegistriesV2 returns result');
  assert.ok(Array.isArray(result.dashboard), 'result has dashboard array');
  assert.ok(Array.isArray(result.api), 'result has api array');
  assert.ok(Array.isArray(result.command), 'result has command array');
  assert.ok(Array.isArray(result.capability), 'result has capability array');
  assert.ok(Array.isArray(result.alias), 'result has alias array');
  console.log('PASS: registry-v2-normalizer — normalized ' + result.dashboard.length + ' tabs, ' + result.api.length + ' apis, ' + result.command.length + ' commands, ' + result.capability.length + ' capabilities, ' + result.alias.length + ' aliases');
}

run().catch(err => { console.error('FAIL:', err.message); process.exit(1); });
