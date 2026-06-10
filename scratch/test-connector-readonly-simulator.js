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

  const mod = require(path.join(ROOT, 'src/connector-hardening/connector-readonly-simulator'));

  check(typeof mod.createReadOnlySimulator === 'function', 'createReadOnlySimulator is a function');
  check(typeof mod.simulateReadOperation === 'function', 'simulateReadOperation is a function');
  check(typeof mod.simulateBatchRead === 'function', 'simulateBatchRead is a function');
  check(typeof mod.validateReadOnly === 'function', 'validateReadOnly is a function');
  check(typeof mod.getSimulationSummary === 'function', 'getSimulationSummary is a function');

  const sim = mod.createReadOnlySimulator('test-connector', {});
  check(sim.connectorId === 'test-connector', 'Simulator has connectorId');
  check(sim.status === 'idle', 'Initial status is idle');

  const readOp = mod.simulateReadOperation(sim, { type: 'read', target: '/users' });
  check(readOp.ok === true, 'Read operation succeeds');
  check(readOp.result.readOnly === true, 'Operation is read-only');

  const listOp = mod.simulateReadOperation(sim, { type: 'list', target: '/items' });
  check(listOp.ok === true, 'List operation succeeds');

  const writeOp = mod.simulateReadOperation(sim, { type: 'write', target: '/data' });
  check(writeOp.ok === false, 'Write operation blocked');

  const nullOp = mod.simulateReadOperation(sim, null);
  check(nullOp.ok === false, 'Null operation returns error');

  const batchResult = mod.simulateBatchRead(sim, [
    { type: 'read', target: '/a' },
    { type: 'list', target: '/b' }
  ]);
  check(batchResult.ok === true, 'Batch read returns ok');

  const readValidation = mod.validateReadOnly({ type: 'read' });
  check(readValidation.readOnly === true, 'Read is valid read-only');

  const writeValidation = mod.validateReadOnly({ type: 'write' });
  check(writeValidation.readOnly === false, 'Write is not read-only');

  const summary = mod.getSimulationSummary(sim);
  check(typeof summary === 'object', 'getSimulationSummary returns object');

  const content = fs.readFileSync(path.join(ROOT, 'src/connector-hardening/connector-readonly-simulator.js'), 'utf8');
  check(!content.includes('TELEGRAM_TOKEN'), 'No TELEGRAM_TOKEN in source');
  check(!content.includes('GITHUB_TOKEN'), 'No GITHUB_TOKEN in source');

  console.log('\n--- Connector Read-Only Simulator: ' + passed + ' passed, ' + failed + ' failed ---');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });
