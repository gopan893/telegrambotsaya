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

  const mod = require(path.join(ROOT, 'src/agent-runtime/agent-runtime-profiler'));

  check(typeof mod.profileTaskExecution === 'function', 'profileTaskExecution is a function');
  check(typeof mod.summarizeProfiles === 'function', 'summarizeProfiles is a function');

  const task = { id: 'task-1', input: 'test input', type: 'coding', class: 'coding', complexity: 'medium' };
  const result = { modelUsed: 'gpt-4o', latencyMs: 1500, tokenCount: 500, costEstimate: 0.005, success: true };

  const profile = mod.profileTaskExecution(task, result);
  check(typeof profile === 'object', 'profileTaskExecution returns object');
  check(profile.taskId === 'task-1', 'Profile has taskId');
  check(profile.modelUsed === 'gpt-4o', 'Profile has model');
  check(profile.latencyMs === 1500, 'Profile has latency');
  check(profile.success === true, 'Profile has success');

  const emptyProfile = mod.profileTaskExecution({}, {});
  check(emptyProfile.success === true, 'Empty task defaults to success');

  const errorResult = { success: false, error: 'timeout' };
  const errorProfile = mod.profileTaskExecution(task, errorResult);
  check(errorProfile.success === false, 'Error result captured');
  check(errorProfile.errorMessage === 'timeout', 'Error message captured');

  const summary = mod.summarizeProfiles([profile, emptyProfile, errorProfile]);
  check(typeof summary === 'object', 'summarizeProfiles returns object');
  check(typeof summary.count === 'number', 'Has count');

  const content = fs.readFileSync(path.join(ROOT, 'src/agent-runtime/agent-runtime-profiler.js'), 'utf8');
  check(!content.includes('TELEGRAM_TOKEN'), 'No TELEGRAM_TOKEN in source');
  check(!content.includes('GITHUB_TOKEN'), 'No GITHUB_TOKEN in source');

  console.log('\n--- Agent Runtime Profiler: ' + passed + ' passed, ' + failed + ' failed ---');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });
