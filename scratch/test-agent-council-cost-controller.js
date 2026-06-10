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

  const mod = require(path.join(ROOT, 'src/agent-runtime/agent-council-cost-controller'));

  check(typeof mod.estimateCouncilCost === 'function', 'estimateCouncilCost is a function');
  check(typeof mod.shouldThrottleCouncil === 'function', 'shouldThrottleCouncil is a function');
  check(typeof mod.limitCouncilAgents === 'function', 'limitCouncilAgents is a function');
  check(typeof mod.limitOpinions === 'function', 'limitOpinions is a function');
  check(typeof mod.limitCritiques === 'function', 'limitCritiques is a function');

  const session = { selectedAgents: ['agent1', 'agent2', 'agent3'], mode: 'normal' };
  const cost = mod.estimateCouncilCost(session);
  check(typeof cost === 'object', 'estimateCouncilCost returns object');
  check(typeof cost.estimatedCost === 'number', 'Has estimatedCost');
  check(cost.agents === 3, 'Agent count correct');

  const debateSession = { selectedAgents: ['a1', 'a2', 'a3'], mode: 'debate' };
  const debateCost = mod.estimateCouncilCost(debateSession);
  check(debateCost.estimatedCost > cost.estimatedCost, 'Debate mode costs more');

  const throttle = mod.shouldThrottleCouncil(session, []);
  check(typeof throttle === 'object', 'shouldThrottleCouncil returns object');

  const limited = mod.limitCouncilAgents(['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7'], {});
  check(Array.isArray(limited), 'limitCouncilAgents returns array');
  check(limited.length <= 6, 'Agents limited to budget');

  const opinions = mod.limitOpinions(['o1', 'o2', 'o3', 'o4', 'o5', 'o6', 'o7', 'o8', 'o9', 'o10', 'o11', 'o12', 'o13'], {});
  check(opinions.length <= 12, 'Opinions limited');

  const critiques = mod.limitCritiques(['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9'], {});
  check(critiques.length <= 8, 'Critiques limited');

  const content = fs.readFileSync(path.join(ROOT, 'src/agent-runtime/agent-council-cost-controller.js'), 'utf8');
  check(!content.includes('TELEGRAM_TOKEN'), 'No TELEGRAM_TOKEN in source');
  check(!content.includes('GITHUB_TOKEN'), 'No GITHUB_TOKEN in source');

  console.log('\n--- Agent Council Cost Controller: ' + passed + ' passed, ' + failed + ' failed ---');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });
