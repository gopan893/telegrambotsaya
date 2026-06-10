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

  const mod = require(path.join(ROOT, 'src/connector-hardening/connector-test-harness'));

  check(typeof mod.createTestHarness === 'function', 'createTestHarness is a function');
  check(typeof mod.runReadOnlyTests === 'function', 'runReadOnlyTests is a function');
  check(typeof mod.simulateWriteProposal === 'function', 'simulateWriteProposal is a function');
  check(typeof mod.classifyConnectorAction === 'function', 'classifyConnectorAction is a function');
  check(typeof mod.getTestSummary === 'function', 'getTestSummary is a function');

  const harness = mod.createTestHarness('test-connector', { baseUrl: 'https://example.com' });
  check(harness.connectorId === 'test-connector', 'Harness has connectorId');
  check(harness.status === 'idle', 'Initial status is idle');

  const tests = [
    { name: 'connection check', fn: (config) => ({ ok: true }) },
    { name: 'read test', fn: (config) => ({ ok: true, data: 'test' }) }
  ];
  const results = mod.runReadOnlyTests(harness, tests);
  check(results.ok === true, 'runReadOnlyTests succeeds');
  check(results.results.length === 2, 'Two tests executed');
  check(harness.status === 'completed' || harness.results.length === 2, 'Harness updated');

  const writeResult = mod.simulateWriteProposal(harness, { type: 'create', target: '/data' });
  check(typeof writeResult === 'object', 'simulateWriteProposal returns object');

  const readClass = mod.classifyConnectorAction('read');
  check(readClass.proposalRequired === false || readClass.level === 'low', 'Read action is low risk');

  const writeClass = mod.classifyConnectorAction('write');
  check(writeClass.proposalRequired === true || writeClass.level !== 'low', 'Write action requires proposal');

  const summary = mod.getTestSummary(harness);
  check(typeof summary === 'object', 'getTestSummary returns object');

  const content = fs.readFileSync(path.join(ROOT, 'src/connector-hardening/connector-test-harness.js'), 'utf8');
  check(!content.includes('TELEGRAM_TOKEN'), 'No TELEGRAM_TOKEN in source');
  check(!content.includes('GITHUB_TOKEN'), 'No GITHUB_TOKEN in source');

  console.log('\n--- Connector Test Harness: ' + passed + ' passed, ' + failed + ' failed ---');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });
