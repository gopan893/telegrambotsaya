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

  const mod = require(path.join(ROOT, 'src/plugin-hardening/plugin-risk-simulator'));

  check(typeof mod.classifyAction === 'function', 'classifyAction is a function');
  check(typeof mod.simulatePluginAction === 'function', 'simulatePluginAction is a function');
  check(typeof mod.batchSimulate === 'function', 'batchSimulate is a function');
  check(typeof mod.getRiskSummary === 'function', 'getRiskSummary is a function');
  check(typeof mod.calculatePluginRiskScore === 'function', 'calculatePluginRiskScore is a function');

  const readRisk = mod.classifyAction('read');
  check(readRisk.level === 'low', 'read is low risk');
  check(readRisk.proposalRequired === false, 'read does not require proposal');

  const shellRisk = mod.classifyAction('shell');
  check(shellRisk.level === 'critical', 'shell is critical risk');
  check(shellRisk.proposalRequired === true, 'shell requires proposal');

  const deployRisk = mod.classifyAction('deploy');
  check(deployRisk.level === 'critical', 'deploy is critical risk');

  const writeRisk = mod.classifyAction('external_write');
  check(writeRisk.level === 'high', 'external_write is high risk');

  const unknownRisk = mod.classifyAction('something_new');
  check(unknownRisk.level === 'medium', 'unknown action is medium risk');

  const nullRisk = mod.classifyAction(null);
  check(nullRisk.level === 'unknown', 'null action is unknown risk');

  const simResult = mod.simulatePluginAction('test-plugin', { type: 'read', target: '/data' }, {});
  check(simResult.ok === true || simResult.proposalOnly === false, 'Read simulation succeeds');
  check(simResult.simulation.pluginId === 'test-plugin', 'Simulation has pluginId');

  const shellSim = mod.simulatePluginAction('test-plugin', { type: 'shell', target: 'ls' }, {});
  check(shellSim.simulation.blockers.length > 0, 'Shell simulation blocked');

  const batchResult = mod.batchSimulate('test-plugin', [{ type: 'read' }, { type: 'shell' }], {});
  check(batchResult.ok === true, 'batchSimulate returns ok');

  const summary = mod.getRiskSummary(batchResult);
  check(typeof summary === 'object', 'getRiskSummary returns object');

  const riskScore = mod.calculatePluginRiskScore([{ type: 'read' }, { type: 'shell' }]);
  check(typeof riskScore === 'number' || typeof riskScore === 'object', 'calculatePluginRiskScore returns number/object');

  const content = fs.readFileSync(path.join(ROOT, 'src/plugin-hardening/plugin-risk-simulator.js'), 'utf8');
  check(!content.includes('TELEGRAM_TOKEN'), 'No TELEGRAM_TOKEN in source');
  check(!content.includes('GITHUB_TOKEN'), 'No GITHUB_TOKEN in source');

  console.log('\n--- Plugin Risk Simulator: ' + passed + ' passed, ' + failed + ' failed ---');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });
