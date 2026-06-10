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

  const mod = require(path.join(ROOT, 'src/agent-runtime/agent-load-controller'));

  check(typeof mod.classifyPriority === 'function', 'classifyPriority is a function');
  check(typeof mod.classifyDomain === 'function', 'classifyDomain is a function');
  check(typeof mod.assessLoad === 'function', 'assessLoad is a function');
  check(typeof mod.buildLoadSnapshot === 'function', 'buildLoadSnapshot is a function');

  const secTask = { type: 'security_incident', description: 'Critical security issue' };
  check(mod.classifyPriority(secTask) === 'P0', 'Security incident is P0');

  const deployTask = { type: 'deploy', description: 'Deploy to production' };
  check(mod.classifyPriority(deployTask) === 'P1', 'Deploy is P1');

  const codingTask = { type: 'coding', description: 'Fix a bug' };
  check(mod.classifyPriority(codingTask) === 'P2', 'Coding is P2');

  const routineTask = { type: 'routine', description: 'Daily standup' };
  check(mod.classifyPriority(routineTask) === 'P3', 'Routine is P3');

  check(mod.classifyDomain(secTask) === 'security', 'Security task classified');
  check(mod.classifyDomain(codingTask) === 'coding', 'Coding task classified');

  const load = mod.assessLoad([
    { type: 'coding' }, { type: 'coding' }, { type: 'research' }
  ]);
  check(typeof load === 'object', 'assessLoad returns object');
  check(typeof load.loadPercent === 'number', 'Has loadPercent');

  const snapshot = mod.buildLoadSnapshot([{ type: 'coding' }]);
  check(typeof snapshot === 'object', 'buildLoadSnapshot returns object');
  check(typeof snapshot.loadPercent === 'number', 'Snapshot has loadPercent');

  const content = fs.readFileSync(path.join(ROOT, 'src/agent-runtime/agent-load-controller.js'), 'utf8');
  check(!content.includes('TELEGRAM_TOKEN'), 'No TELEGRAM_TOKEN in source');
  check(!content.includes('GITHUB_TOKEN'), 'No GITHUB_TOKEN in source');

  console.log('\n--- Agent Load Controller: ' + passed + ' passed, ' + failed + ' failed ---');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });
