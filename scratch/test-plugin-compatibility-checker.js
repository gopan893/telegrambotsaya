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

  const mod = require(path.join(ROOT, 'src/plugin-hardening/plugin-compatibility-checker'));

  check(typeof mod.validateManifest === 'function', 'validateManifest is a function');
  check(typeof mod.checkNodeCompatibility === 'function', 'checkNodeCompatibility is a function');
  check(typeof mod.checkAiOsCompatibility === 'function', 'checkAiOsCompatibility is a function');
  check(typeof mod.checkDependencyCompatibility === 'function', 'checkDependencyCompatibility is a function');
  check(typeof mod.checkConnectorCompatibility === 'function', 'checkConnectorCompatibility is a function');
  check(typeof mod.runFullCompatibilityCheck === 'function', 'runFullCompatibilityCheck is a function');

  const goodManifest = { id: 'test-plugin', name: 'Test', version: '1.0.0', main: 'index.js', type: 'module' };
  const badManifest = { name: 'NoId' };

  const validResult = mod.validateManifest(goodManifest);
  check(validResult.valid === true, 'Valid manifest passes validation');
  check(Array.isArray(validResult.errors) && validResult.errors.length === 0, 'Valid manifest has no errors');

  const invalidResult = mod.validateManifest(badManifest);
  check(invalidResult.valid === false, 'Invalid manifest fails validation');
  check(invalidResult.errors.length > 0, 'Invalid manifest reports errors');

  const nullResult = mod.validateManifest(null);
  check(nullResult.valid === false, 'Null manifest fails validation');

  const nodeResult = mod.checkNodeCompatibility(goodManifest);
  check(typeof nodeResult === 'object', 'checkNodeCompatibility returns object');

  const fullResult = mod.runFullCompatibilityCheck(goodManifest, {});
  check(typeof fullResult === 'object', 'runFullCompatibilityCheck returns object');
  check(typeof fullResult.compatible === 'boolean' || typeof fullResult.valid === 'boolean', 'Full check has compatible/valid field');

  const content = fs.readFileSync(path.join(ROOT, 'src/plugin-hardening/plugin-compatibility-checker.js'), 'utf8');
  check(!content.includes('TELEGRAM_TOKEN'), 'No TELEGRAM_TOKEN in source');
  check(!content.includes('GITHUB_TOKEN'), 'No GITHUB_TOKEN in source');

  console.log('\n--- Plugin Compatibility Checker: ' + passed + ' passed, ' + failed + ' failed ---');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });
