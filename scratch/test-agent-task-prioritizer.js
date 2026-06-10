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

  const mod = require(path.join(ROOT, 'src/agent-runtime/agent-task-prioritizer'));

  check(typeof mod.prioritizeTask === 'function', 'prioritizeTask is a function');
  check(typeof mod.assessUrgency === 'function', 'assessUrgency is a function');
  check(typeof mod.assessImpact === 'function', 'assessImpact is a function');
  check(typeof mod.assessEffort === 'function', 'assessEffort is a function');
  check(typeof mod.computePriorityScore === 'function', 'computePriorityScore is a function');
  check(typeof mod.suggestAgent === 'function', 'suggestAgent is a function');
  check(typeof mod.sortByPriority === 'function', 'sortByPriority is a function');
  check(typeof mod.filterByPriority === 'function', 'filterByPriority is a function');

  const task = { id: 'task-1', type: 'coding', description: 'Fix login bug', complexity: 'medium' };
  const prioritized = mod.prioritizeTask(task, {});
  check(typeof prioritized === 'object', 'prioritizeTask returns object');
  check(typeof prioritized.priority === 'string', 'Has priority');
  check(typeof prioritized.score === 'number', 'Has score');
  check(typeof prioritized.recommendedAgent === 'string', 'Has recommendedAgent');

  const urgency = mod.assessUrgency(task, {});
  check(typeof urgency === 'string' || typeof urgency === 'number', 'assessUrgency returns value');

  const impact = mod.assessImpact(task, {});
  check(typeof impact === 'string' || typeof impact === 'number', 'assessImpact returns value');

  const effort = mod.assessEffort(task);
  check(typeof effort === 'string' || typeof effort === 'number', 'assessEffort returns value');

  const score = mod.computePriorityScore('P1', 'high', 'high', 'medium');
  check(typeof score === 'number', 'computePriorityScore returns number');

  const agent = mod.suggestAgent('coding', 'P1');
  check(typeof agent === 'string' && agent.length > 0, 'suggestAgent returns non-empty string');

  const sorted = mod.sortByPriority([prioritized, mod.prioritizeTask({ id: 'task-2', type: 'routine' }, {})]);
  check(Array.isArray(sorted), 'sortByPriority returns array');

  const content = fs.readFileSync(path.join(ROOT, 'src/agent-runtime/agent-task-prioritizer.js'), 'utf8');
  check(!content.includes('TELEGRAM_TOKEN'), 'No TELEGRAM_TOKEN in source');
  check(!content.includes('GITHUB_TOKEN'), 'No GITHUB_TOKEN in source');

  console.log('\n--- Agent Task Prioritizer: ' + passed + ' passed, ' + failed + ' failed ---');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });
