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

  const mod = require(path.join(ROOT, 'src/connector-hardening/connector-contract-validator'));

  check(typeof mod.validateContract === 'function', 'validateContract is a function');
  check(typeof mod.checkCapabilityContract === 'function', 'checkCapabilityContract is a function');
  check(typeof mod.validateConnectorInterface === 'function', 'validateConnectorInterface is a function');
  check(typeof mod.checkVersionContract === 'function', 'checkVersionContract is a function');
  check(typeof mod.summarizeContract === 'function', 'summarizeContract is a function');

  const goodContract = { id: 'github', type: 'github', version: '1.0.0', capabilities: ['read', 'write'] };
  const validResult = mod.validateContract(goodContract);
  check(validResult.valid === true, 'Valid contract passes validation');
  check(validResult.errors.length === 0, 'Valid contract has no errors');

  const badContract = { name: 'NoId' };
  const invalidResult = mod.validateContract(badContract);
  check(invalidResult.valid === false, 'Invalid contract fails validation');
  check(invalidResult.errors.length > 0, 'Invalid contract reports errors');

  const nullResult = mod.validateContract(null);
  check(nullResult.valid === false, 'Null contract fails validation');

  const badType = { id: 'x', type: 'unknown_type', version: '1.0.0', capabilities: [] };
  const badTypeResult = mod.validateContract(badType);
  check(badTypeResult.valid === false, 'Unknown connector type fails validation');

  const capCheck = mod.checkCapabilityContract(goodContract, ['read', 'write']);
  check(capCheck.satisfied === true || capCheck.missing.length === 0, 'Required capabilities satisfied');

  const missingCap = mod.checkCapabilityContract(goodContract, ['read', 'write', 'deploy']);
  check(missingCap.missing.length > 0 || missingCap.satisfied === false, 'Missing capability detected');

  const interfaceResult = mod.validateConnectorInterface(goodContract);
  check(typeof interfaceResult === 'object', 'validateConnectorInterface returns object');

  const versionCheck = mod.checkVersionContract(goodContract, '0.5.0');
  check(versionCheck.satisfied === true || versionCheck.valid === true, 'Version contract satisfied');

  const summary = mod.summarizeContract(goodContract);
  check(typeof summary === 'object', 'summarizeContract returns object');

  const content = fs.readFileSync(path.join(ROOT, 'src/connector-hardening/connector-contract-validator.js'), 'utf8');
  check(!content.includes('TELEGRAM_TOKEN'), 'No TELEGRAM_TOKEN in source');
  check(!content.includes('GITHUB_TOKEN'), 'No GITHUB_TOKEN in source');

  console.log('\n--- Connector Contract Validator: ' + passed + ' passed, ' + failed + ' failed ---');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });
