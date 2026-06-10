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

  const agentRouteFile = path.join(ROOT, 'src/dashboard/agent-routes.js');
  check(fs.existsSync(agentRouteFile), 'agent-routes.js exists');
  const agentContent = fs.readFileSync(agentRouteFile, 'utf8');
  check(!agentContent.includes('TELEGRAM_TOKEN'), 'No TELEGRAM_TOKEN in agent-routes');
  check(!agentContent.includes('GITHUB_TOKEN'), 'No GITHUB_TOKEN in agent-routes');
  try { new Function(agentContent); check(true, 'agent-routes syntax OK'); } catch (e) { check(false, 'agent-routes syntax: ' + e.message); }

  const modelRouteFile = path.join(ROOT, 'src/dashboard/model-router-routes.js');
  check(fs.existsSync(modelRouteFile), 'model-router-routes.js exists');
  const modelContent = fs.readFileSync(modelRouteFile, 'utf8');
  check(!modelContent.includes('TELEGRAM_TOKEN'), 'No TELEGRAM_TOKEN in model-router-routes');
  check(!modelContent.includes('GITHUB_TOKEN'), 'No GITHUB_TOKEN in model-router-routes');
  try { new Function(modelContent); check(true, 'model-router-routes syntax OK'); } catch (e) { check(false, 'model-router-routes syntax: ' + e.message); }

  const agentModules = [
    'agent-runtime-profiler', 'agent-load-controller', 'agent-task-prioritizer',
    'agent-response-quality-scorer', 'agent-council-cost-controller',
    'agent-runtime-health-monitor', 'agent-runtime-regression-detector'
  ];
  for (const m of agentModules) {
    const fp = path.join(ROOT, 'src/agent-runtime/' + m + '.js');
    check(fs.existsSync(fp), m + '.js exists');
    if (fs.existsSync(fp)) {
      const c = fs.readFileSync(fp, 'utf8');
      check(!c.includes('TELEGRAM_TOKEN'), m + ' has no TELEGRAM_TOKEN');
      check(!c.includes('GITHUB_TOKEN'), m + ' has no GITHUB_TOKEN');
      try { new Function(c); check(true, m + ' syntax OK'); } catch (e) { check(false, m + ' syntax: ' + e.message); }
    }
  }

  const modelModules = [
    'task-model-strategy-engine', 'model-routing-policy-v2', 'local-cloud-fallback-strategy',
    'model-cost-estimator', 'model-latency-tracker', 'model-quality-evaluator',
    'model-budget-governor', 'model-benchmark-planner'
  ];
  for (const m of modelModules) {
    const fp = path.join(ROOT, 'src/model-strategy/' + m + '.js');
    check(fs.existsSync(fp), m + '.js exists');
    if (fs.existsSync(fp)) {
      const c = fs.readFileSync(fp, 'utf8');
      check(!c.includes('TELEGRAM_TOKEN'), m + ' has no TELEGRAM_TOKEN');
      check(!c.includes('GITHUB_TOKEN'), m + ' has no GITHUB_TOKEN');
      try { new Function(c); check(true, m + ' syntax OK'); } catch (e) { check(false, m + ' syntax: ' + e.message); }
    }
  }
  const privacyGuardFile = path.join(ROOT, 'src/model-strategy/model-privacy-guard.js');
  check(fs.existsSync(privacyGuardFile), 'model-privacy-guard.js exists');
  if (fs.existsSync(privacyGuardFile)) {
    const pgContent = fs.readFileSync(privacyGuardFile, 'utf8');
    check(!pgContent.includes("process.env['TELEGRAM_TOKEN']"), 'model-privacy-guard has no env value access');
    check(!pgContent.includes("process.env['GITHUB_TOKEN']"), 'model-privacy-guard has no env value access');
    try { new Function(pgContent); check(true, 'model-privacy-guard syntax OK'); } catch (e) { check(false, 'model-privacy-guard syntax: ' + e.message); }
  }

  console.log('\n--- Phase 70 Agent Runtime/Model Strategy Regression: ' + passed + ' passed, ' + failed + ' failed ---');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });
