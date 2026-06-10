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

  const mod = require(path.join(ROOT, 'src/agent-runtime/agent-runtime-health-monitor'));

  check(typeof mod.checkRuntimeHealth === 'function', 'checkRuntimeHealth is a function');
  check(typeof mod.detectLoop === 'function', 'detectLoop is a function');
  check(typeof mod.detectStalledTasks === 'function', 'detectStalledTasks is a function');
  check(typeof mod.buildHealthCheckResult === 'function', 'buildHealthCheckResult is a function');

  const profiles = [
    { latencyMs: 1000, success: true },
    { latencyMs: 2000, success: true },
    { latencyMs: 500, success: true }
  ];
  const loadSnapshots = [{ loadPercent: 40 }];

  const health = mod.checkRuntimeHealth(profiles, loadSnapshots);
  check(typeof health === 'object', 'checkRuntimeHealth returns object');
  check(health.status === 'healthy' || health.status === 'degraded', 'Has valid status');
  check(typeof health.avgLatency === 'number', 'Has avgLatency');
  check(typeof health.errorRate === 'number', 'Has errorRate');

  const loopProfiles = [
    { taskType: 'coding', agentId: 'a1' },
    { taskType: 'coding', agentId: 'a1' },
    { taskType: 'coding', agentId: 'a1' },
    { taskType: 'coding', agentId: 'a1' },
    { taskType: 'coding', agentId: 'a1' }
  ];
  const loopResult = mod.detectLoop(loopProfiles);
  check(typeof loopResult === 'object', 'detectLoop returns object');

  const stalledResult = mod.detectStalledTasks([]);
  check(typeof stalledResult === 'object', 'detectStalledTasks returns object');

  const built = mod.buildHealthCheckResult(profiles, loadSnapshots);
  check(typeof built === 'object', 'buildHealthCheckResult returns object');

  const content = fs.readFileSync(path.join(ROOT, 'src/agent-runtime/agent-runtime-health-monitor.js'), 'utf8');
  check(!content.includes('TELEGRAM_TOKEN'), 'No TELEGRAM_TOKEN in source');
  check(!content.includes('GITHUB_TOKEN'), 'No GITHUB_TOKEN in source');

  console.log('\n--- Agent Runtime Health Monitor: ' + passed + ' passed, ' + failed + ' failed ---');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });
