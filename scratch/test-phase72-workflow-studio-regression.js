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

  const routeFile = path.join(ROOT, 'src/dashboard/workflow-studio-routes.js');
  check(fs.existsSync(routeFile), 'workflow-studio-routes.js exists');
  if (fs.existsSync(routeFile)) {
    const content = fs.readFileSync(routeFile, 'utf8');
    check(!content.includes('TELEGRAM_TOKEN'), 'No TELEGRAM_TOKEN in workflow-studio-routes');
    check(!content.includes('GITHUB_TOKEN'), 'No GITHUB_TOKEN in workflow-studio-routes');
    try { new Function(content); check(true, 'workflow-studio-routes.js passes syntax'); } catch (e) { check(false, 'workflow-studio-routes syntax: ' + e.message); }
  }

  const jsFile = path.join(ROOT, 'public/dashboard/workflow-studio.js');
  check(fs.existsSync(jsFile), 'workflow-studio.js exists');
  if (fs.existsSync(jsFile)) {
    const content = fs.readFileSync(jsFile, 'utf8');
    check(!content.includes('TELEGRAM_TOKEN'), 'No TELEGRAM_TOKEN in workflow-studio.js');
    check(!content.includes('GITHUB_TOKEN'), 'No GITHUB_TOKEN in workflow-studio.js');
  }

  const stateContent = fs.readFileSync(path.join(ROOT, 'public/dashboard/state.js'), 'utf8');
  check(stateContent.includes("'workflow-studio'"), 'state.js has workflow-studio entry');
  check(!stateContent.includes('TELEGRAM_TOKEN'), 'No TELEGRAM_TOKEN in state.js');

  const indexContent = fs.readFileSync(path.join(ROOT, 'public/dashboard/index.html'), 'utf8');
  check(indexContent.includes('data-tab="workflow-studio"'), 'Sidebar has workflow-studio entry');

  const swContent = fs.readFileSync(path.join(ROOT, 'public/dashboard/service-worker.js'), 'utf8');
  check(swContent.includes('/dashboard/workflow-studio.js'), 'SW has workflow-studio.js');

  const wsModules = [
    'workflow-natural-parser', 'workflow-template-library', 'workflow-step-contract',
    'workflow-builder', 'workflow-validator', 'workflow-risk-simulator',
    'workflow-approval-mapper', 'workflow-dry-runner', 'workflow-proposal-bridge',
    'workflow-scheduler-planner', 'workflow-run-history', 'workflow-recipe-bridge',
    'workflow-device-bridge', 'workflow-plugin-bridge', 'workflow-rag-bridge',
    'workflow-model-bridge', 'workflow-operating-loop-bridge'
  ];
  for (const m of wsModules) {
    const fp = path.join(ROOT, 'src/workflow-studio/' + m + '.js');
    check(fs.existsSync(fp), m + '.js exists');
    if (fs.existsSync(fp)) {
      const c = fs.readFileSync(fp, 'utf8');
      if (m !== 'workflow-step-contract') {
        check(!c.includes('TELEGRAM_TOKEN'), m + ' has no TELEGRAM_TOKEN');
        check(!c.includes('GITHUB_TOKEN'), m + ' has no GITHUB_TOKEN');
      }
      try { new Function(c); check(true, m + ' passes syntax'); } catch (e) { check(false, m + ' syntax: ' + e.message); }
    }
  }

  const stepContractFile = path.join(ROOT, 'src/workflow-studio/workflow-step-contract.js');
  if (fs.existsSync(stepContractFile)) {
    const sc = fs.readFileSync(stepContractFile, 'utf8');
    const hasTokenAsPattern = sc.includes("pattern: /\\bTELEGRAM_TOKEN\\b/i") || sc.includes("TELEGRAM_TOKEN')") || sc.includes('"TELEGRAM_TOKEN"');
    check(hasTokenAsPattern, 'workflow-step-contract uses TELEGRAM_TOKEN as detection pattern (not a secret)');
    const hasGithubAsPattern = sc.includes("pattern: /\\bGITHUB_TOKEN\\b/i") || sc.includes("GITHUB_TOKEN')") || sc.includes('"GITHUB_TOKEN"');
    check(hasGithubAsPattern, 'workflow-step-contract uses GITHUB_TOKEN as detection pattern (not a secret)');
  }

  console.log('\n--- Phase 72 Workflow Studio Regression: ' + passed + ' passed, ' + failed + ' failed ---');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });
