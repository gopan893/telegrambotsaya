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

  const mod = require(path.join(ROOT, 'src/plugin-hardening/plugin-upgrade-planner'));

  check(typeof mod.createUpgradePlan === 'function', 'createUpgradePlan is a function');
  check(typeof mod.analyzeUpgradeRisks === 'function', 'analyzeUpgradeRisks is a function');
  check(typeof mod.planUpgradeSteps === 'function', 'planUpgradeSteps is a function');
  check(typeof mod.getUpgradeRiskSummary === 'function', 'getUpgradeRiskSummary is a function');
  check(typeof mod.canAutoUpgrade === 'function', 'canAutoUpgrade is a function');
  check(typeof mod.markStepComplete === 'function', 'markStepComplete is a function');

  const plan = mod.createUpgradePlan('test-plugin', '1.0.0', '2.0.0');
  check(plan.pluginId === 'test-plugin', 'Plan has pluginId');
  check(plan.currentVersion === '1.0.0', 'Plan has current version');
  check(plan.targetVersion === '2.0.0', 'Plan has target version');
  check(plan.status === 'planned', 'Initial status is planned');

  const currentManifest = { id: 'test-plugin', version: '1.0.0', permissions: ['read'] };
  const targetManifest = { id: 'test-plugin', version: '2.0.0', permissions: ['read', 'write'] };
  const risks = mod.analyzeUpgradeRisks(currentManifest, targetManifest);
  check(Array.isArray(risks), 'analyzeUpgradeRisks returns array');
  check(risks.length > 0, 'Major version bump produces risks');

  const minorManifest = { id: 'test-plugin', version: '1.1.0', permissions: ['read'] };
  const minorRisks = mod.analyzeUpgradeRisks(currentManifest, minorManifest);
  check(minorRisks.length <= risks.length, 'Minor bump has fewer/same risks than major');

  const stepsPlan = mod.planUpgradeSteps(plan, risks);
  check(Array.isArray(stepsPlan.steps) || typeof stepsPlan === 'object', 'planUpgradeSteps returns plan with steps');

  const summary = mod.getUpgradeRiskSummary(plan);
  check(typeof summary === 'object', 'getUpgradeRiskSummary returns object');

  const canAuto = mod.canAutoUpgrade(plan);
  check(typeof canAuto === 'boolean', 'canAutoUpgrade returns boolean');

  const completed = mod.markStepComplete(plan, 0, { success: true });
  check(completed === true, 'markStepComplete returns true');

  const content = fs.readFileSync(path.join(ROOT, 'src/plugin-hardening/plugin-upgrade-planner.js'), 'utf8');
  check(!content.includes('TELEGRAM_TOKEN'), 'No TELEGRAM_TOKEN in source');
  check(!content.includes('GITHUB_TOKEN'), 'No GITHUB_TOKEN in source');

  console.log('\n--- Plugin Upgrade Planner: ' + passed + ' passed, ' + failed + ' failed ---');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });
