'use strict';
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const ROOT = path.join(__dirname, '..');

async function run() {
  let passed = 0;
  let failed = 0;
  const failures = [];

  function check(ok, msg) {
    if (ok) { console.log('PASS: ' + msg); passed++; }
    else { console.log('FAIL: ' + msg); failed++; failures.push(msg); }
  }

  console.log('=== Phase 66 V2 Production Release Regression ===\n');

  /* 1. Module files exist */
  const sourceFiles = [
    'src/v2-production/v2-production-release-manager.js',
    'src/v2-production/v2-production-readiness-gate.js',
    'src/v2-production/v2-production-release-store.js',
    'src/v2-production/v2-production-utils.js',
    'src/v2-production/v2-rollout-planner.js',
    'src/v2-production/v2-github-release-proposal-builder.js',
    'src/v2-production/v2-deploy-proposal-builder.js',
    'src/v2-production/v2-production-verification-checker.js',
    'src/v2-production/v2-release-announcement-generator.js',
    'src/v2-production/v2-production-rollback-coordinator.js'
  ];
  for (const f of sourceFiles) {
    check(fs.existsSync(path.join(ROOT, f)), 'Source file exists: ' + f);
  }

  const infraFiles = [
    'src/dashboard/v2-production-routes.js',
    'public/dashboard/v2-production.js'
  ];
  for (const f of infraFiles) {
    check(fs.existsSync(path.join(ROOT, f)), 'Infra file exists: ' + f);
  }

  /* 2. Load all modules */
  const prodStore = require(path.join(ROOT, 'src/v2-production/v2-production-release-store'));
  const prodUtils = require(path.join(ROOT, 'src/v2-production/v2-production-utils'));
  const mgr = require(path.join(ROOT, 'src/v2-production/v2-production-release-manager'));
  const gate = require(path.join(ROOT, 'src/v2-production/v2-production-readiness-gate'));
  const planner = require(path.join(ROOT, 'src/v2-production/v2-rollout-planner'));
  const gh = require(path.join(ROOT, 'src/v2-production/v2-github-release-proposal-builder'));
  const deploy = require(path.join(ROOT, 'src/v2-production/v2-deploy-proposal-builder'));
  const verifier = require(path.join(ROOT, 'src/v2-production/v2-production-verification-checker'));
  const ann = require(path.join(ROOT, 'src/v2-production/v2-release-announcement-generator'));
  const rollback = require(path.join(ROOT, 'src/v2-production/v2-production-rollback-coordinator'));
  const routes = require(path.join(ROOT, 'src/dashboard/v2-production-routes'));

  check(typeof mgr.createV2ProductionRelease === 'function', 'mgr.createV2ProductionRelease loaded');
  check(typeof mgr.getV2ProductionReleaseStatus === 'function', 'mgr.getV2ProductionReleaseStatus loaded');
  check(typeof gate.runV2ProductionReadinessGate === 'function', 'gate.runV2ProductionReadinessGate loaded');
  check(typeof planner.createV2RolloutPlan === 'function', 'planner.createV2RolloutPlan loaded');
  check(typeof gh.buildV2GitHubTagProposal === 'function', 'gh.buildV2GitHubTagProposal loaded');
  check(typeof gh.buildV2GitHubReleaseProposal === 'function', 'gh.buildV2GitHubReleaseProposal loaded');
  check(typeof deploy.buildV2DeployProposal === 'function', 'deploy.buildV2DeployProposal loaded');
  check(typeof verifier.runV2ProductionVerification === 'function', 'verifier.runV2ProductionVerification loaded');
  check(typeof ann.generateV2ReleaseAnnouncement === 'function', 'ann.generateV2ReleaseAnnouncement loaded');
  check(typeof rollback.prepareV2ProductionRollbackPlan === 'function', 'rollback.prepareV2ProductionRollbackPlan loaded');
  check(typeof routes.registerV2ProductionRoutes === 'function', 'routes.registerV2ProductionRoutes loaded');

  /* 3. Run core functions */
  prodStore.clearAll();

  const release = await mgr.createV2ProductionRelease({ version: 'v2.0.0' }, {});
  check(!!release && !!release.id, 'createV2ProductionRelease works');

  const status = await mgr.getV2ProductionReleaseStatus(release.id, {});
  check(status.exists === true, 'getV2ProductionReleaseStatus works');

  const summary = await mgr.buildV2ProductionReleaseSummary(release.id, {});
  check(summary.id === release.id, 'buildV2ProductionReleaseSummary works');

  const gateResult = await gate.runV2ProductionReadinessGate(release.id, {});
  check(typeof gateResult.passed === 'boolean', 'runV2ProductionReadinessGate works');

  const rolloutPlan = await planner.createV2RolloutPlan(release.id, {});
  check(rolloutPlan.releaseId === release.id, 'createV2RolloutPlan works');

  const tagProp = await gh.buildV2GitHubTagProposal(release.id, {});
  check(tagProp.status === 'proposal', 'buildV2GitHubTagProposal is proposal-only');

  const relProp = await gh.buildV2GitHubReleaseProposal(release.id, {});
  check(relProp.status === 'proposal', 'buildV2GitHubReleaseProposal is proposal-only');

  const depProp = await deploy.buildV2DeployProposal(release.id, {});
  check(depProp.status === 'proposal', 'buildV2DeployProposal is proposal-only');

  prodStore.updateV2ProductionRelease(release.id, { readinessStatus: 'ready' });
  const verResult = await verifier.runV2ProductionVerification(release.id, { projectRoot: ROOT, entryFile: 'telebot.js' });
  check(typeof verResult.passed === 'boolean', 'runV2ProductionVerification works');

  const announcement = await ann.generateV2ReleaseAnnouncement(release.id, {});
  check(announcement.releaseId === release.id, 'generateV2ReleaseAnnouncement works');

  const rollbackPlan = await rollback.prepareV2ProductionRollbackPlan(release.id, {});
  check(rollbackPlan.summary.includes('No direct rollback'), 'prepareV2ProductionRollbackPlan is proposal-only');

  /* 4. Verify no direct deploy/rollback/tag */
  check(tagProp.note.includes('PROPOSAL ONLY'), 'Tag proposal marked PROPOSAL ONLY');
  check(relProp.note.includes('PROPOSAL ONLY'), 'Release proposal marked PROPOSAL ONLY');
  check(depProp.note.includes('PROPOSAL ONLY'), 'Deploy proposal marked PROPOSAL ONLY');
  check(depProp.note.includes('No deploy'), 'Deploy proposal confirms no direct deploy');
  check(rollbackPlan.proposal.note.includes('PROPOSAL ONLY'), 'Rollback proposal marked PROPOSAL ONLY');

  /* 5. Verify no secrets */
  const routeContent = fs.readFileSync(path.join(ROOT, 'src/dashboard/v2-production-routes.js'), 'utf8');
  check(!routeContent.includes('TELEGRAM_TOKEN'), 'Route file does not contain TELEGRAM_TOKEN literal');
  check(!routeContent.includes('GITHUB_TOKEN'), 'Route file does not contain GITHUB_TOKEN literal');

  const dashContent = fs.readFileSync(path.join(ROOT, 'public/dashboard/v2-production.js'), 'utf8');
  check(dashContent.includes('UI.renderV2Production'), 'Dashboard JS registers UI.renderV2Production');

  /* 6. Syntax checks */
  const syntaxFiles = [
    'src/dashboard/v2-production-routes.js',
    'src/v2-production/v2-production-release-manager.js',
    'src/v2-production/v2-production-readiness-gate.js',
    'src/v2-production/v2-production-release-store.js',
    'src/v2-production/v2-production-utils.js',
    'src/v2-production/v2-rollout-planner.js',
    'src/v2-production/v2-github-release-proposal-builder.js',
    'src/v2-production/v2-deploy-proposal-builder.js',
    'src/v2-production/v2-production-verification-checker.js',
    'src/v2-production/v2-release-announcement-generator.js',
    'src/v2-production/v2-production-rollback-coordinator.js'
  ];
  for (const f of syntaxFiles) {
    try {
      execSync('node --check "' + path.join(ROOT, f) + '"', { stdio: 'pipe' });
      check(true, 'Syntax check passed: ' + f);
    } catch (e) {
      check(false, 'Syntax check failed: ' + f + ' - ' + (e.stderr || '').toString().trim());
    }
  }

  console.log('\n=== Phase 66 V2 Production Release Regression: ' + passed + ' passed, ' + failed + ' failed ===');
  if (failures.length > 0) {
    for (const f of failures) {
      console.error('  FAILED: ' + f);
    }
  }
  if (failed > 0) process.exit(1);
}

run().catch(err => { console.error('FAIL:', err.message); process.exit(1); });
