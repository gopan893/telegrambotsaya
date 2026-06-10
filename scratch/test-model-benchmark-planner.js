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

  const mod = require(path.join(ROOT, 'src/model-strategy/model-benchmark-planner'));

  check(typeof mod.createBenchmarkPlan === 'function', 'createBenchmarkPlan is a function');
  check(typeof mod.executeBenchmarkStep === 'function', 'executeBenchmarkStep is a function');
  check(typeof mod.summarizeBenchmarkResults === 'function', 'summarizeBenchmarkResults is a function');

  const plan = mod.createBenchmarkPlan(['gpt-4o', 'local-default'], ['coding', 'research']);
  check(typeof plan === 'object', 'createBenchmarkPlan returns object');
  check(plan.models.length === 2, 'Plan has 2 models');
  check(plan.taskTypes.length === 2, 'Plan has 2 task types');
  check(plan.status === 'planned', 'Initial status is planned');

  const defaultPlan = mod.createBenchmarkPlan([], []);
  check(defaultPlan.models.length > 0, 'Default plan has models');
  check(defaultPlan.taskTypes.length > 0, 'Default plan has task types');

  const step = mod.executeBenchmarkStep(plan, 'gpt-4o', 'coding');
  check(typeof step === 'object', 'executeBenchmarkStep returns object');
  check(step.model === 'gpt-4o', 'Step has model');
  check(typeof step.latencyMs === 'number', 'Step has latency');
  check(typeof step.cost === 'number', 'Step has cost');
  check(typeof step.quality === 'number', 'Step has quality');

  const results = [step, mod.executeBenchmarkStep(plan, 'local-default', 'coding')];
  const summary = mod.summarizeBenchmarkResults(results);
  check(typeof summary === 'object', 'summarizeBenchmarkResults returns object');
  check(typeof summary.byModel === 'object' || Array.isArray(summary.byModel), 'Summary has model data');

  const content = fs.readFileSync(path.join(ROOT, 'src/model-strategy/model-benchmark-planner.js'), 'utf8');
  check(!content.includes('TELEGRAM_TOKEN'), 'No TELEGRAM_TOKEN in source');
  check(!content.includes('GITHUB_TOKEN'), 'No GITHUB_TOKEN in source');

  console.log('\n--- Model Benchmark Planner: ' + passed + ' passed, ' + failed + ' failed ---');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });
