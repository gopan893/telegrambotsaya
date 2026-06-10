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

  const mod = require(path.join(ROOT, 'src/connector-hardening/connector-write-proposal-simulator'));

  check(typeof mod.createWriteProposalSimulator === 'function', 'createWriteProposalSimulator is a function');
  check(typeof mod.simulateWriteProposal === 'function', 'simulateWriteProposal is a function');
  check(typeof mod.simulateBatchProposals === 'function', 'simulateBatchProposals is a function');
  check(typeof mod.classifyWriteAction === 'function', 'classifyWriteAction is a function');
  check(typeof mod.getProposalSummary === 'function', 'getProposalSummary is a function');
  check(typeof mod.ensureNeverExecutesRealWrites === 'function', 'ensureNeverExecutesRealWrites is a function');

  const sim = mod.createWriteProposalSimulator('test-connector', {});
  check(sim.connectorId === 'test-connector', 'Simulator has connectorId');
  check(sim.status === 'idle', 'Initial status is idle');

  const readAction = mod.simulateWriteProposal(sim, { type: 'read', target: '/data' });
  check(readAction.ok === true || readAction.proposalOnly === true, 'Read proposal succeeds');

  const writeAction = mod.simulateWriteProposal(sim, { type: 'create', target: '/data' });
  check(writeAction.proposalOnly === true, 'Write action is proposal-only');
  check(writeAction.wouldExecute === false, 'Would not execute real write');

  const shellAction = mod.simulateWriteProposal(sim, { type: 'shell', target: 'rm -rf /' });
  check(shellAction.blocked === true || shellAction.risk.level === 'critical', 'Shell action blocked');

  const batchResult = mod.simulateBatchProposals(sim, [
    { type: 'read' },
    { type: 'create' }
  ]);
  check(Array.isArray(batchResult), 'Batch proposals returns array');

  const readClass = mod.classifyWriteAction('read');
  check(readClass.proposalRequired === false || readClass.level === 'low', 'Read is low risk');

  const writeClass = mod.classifyWriteAction('create');
  check(writeClass.proposalRequired === true || writeClass.level !== 'low', 'Create requires proposal');

  const summary = mod.getProposalSummary(sim);
  check(typeof summary === 'object', 'getProposalSummary returns object');

  const safetyCheck = mod.ensureNeverExecutesRealWrites();
  check(safetyCheck.safe === true || safetyCheck.neverExecutes === true, 'Safety check confirms no real writes');

  const content = fs.readFileSync(path.join(ROOT, 'src/connector-hardening/connector-write-proposal-simulator.js'), 'utf8');
  check(!content.includes('TELEGRAM_TOKEN'), 'No TELEGRAM_TOKEN in source');
  check(!content.includes('GITHUB_TOKEN'), 'No GITHUB_TOKEN in source');

  console.log('\n--- Connector Write Proposal Simulator: ' + passed + ' passed, ' + failed + ' failed ---');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });
