'use strict';

const store = require('../src/deploy/deploy-release-store');
const utils = require('../src/deploy/deploy-utils');
const rcm = require('../src/deploy/release-candidate-manager');
const planGen = require('../src/deploy/deploy-plan-generator');
const proposalBuilder = require('../src/deploy/deploy-proposal-builder');
const monitor = require('../src/deploy/post-deploy-monitor');
const rollback = require('../src/deploy/rollback-plan-generator');
const deployGate = require('../src/deploy/render-deploy-gate');
const envChecker = require('../src/deploy/render-env-checker');
const startupChecker = require('../src/deploy/render-startup-checker');
const resultRouter = require('../src/deploy/deploy-result-router');

let passed = 0, failed = 0;
function assert(cond, label) {
  if (cond) { passed++; console.log('  ✅ ' + label); }
  else { failed++; console.log('  ❌ ' + label); }
}

console.log('\n--- Phase 36 Deploy Regression ---');
store.clear();

// 1. Full lifecycle: RC → gate → plan → proposal → post-check → rollback
const rc = rcm.createReleaseCandidate({ branch: 'main', commitSha: 'def456', commitMessage: 'Phase 36' });
assert(rc.ok, 'RC created');

rcm.updateReleaseCandidateStatus(rc.candidate.id, 'validated');
assert(rcm.getReleaseCandidate(rc.candidate.id).candidate.status === 'validated', 'RC status updated');

const gate = deployGate.runRenderDeployGate(rc.candidate.id, { repoRoot: process.cwd() });
assert(gate.ok, 'Render gate passes');

const envCheck = envChecker.checkRenderRequiredEnvNames({ env: { TELEGRAM_TOKEN: 'x', OWNER_CHAT_ID: 'y', DASHBOARD_ADMIN_TOKEN: 'z', PORT: '10000' } });
assert(envCheck.ok, 'env check passes with mock');

const startup = startupChecker.buildStartupCheckReport({ repoRoot: process.cwd() });
assert(startup.ok, 'startup check passes');

const plan = planGen.createDeployPlan(rc.candidate.id, { provider: 'render' }, { repoRoot: process.cwd() });
assert(plan.ok, 'deploy plan created');

rcm.linkReleaseCandidateToDeployPlan(rc.candidate.id, plan.plan.id);
assert(rcm.getReleaseCandidate(rc.candidate.id).candidate.deployPlanId === plan.plan.id, 'RC linked to plan');

const proposal = proposalBuilder.createDeployProposal(plan.plan.id, {});
assert(proposal.ok, 'deploy proposal created');

const postCheck = monitor.runPostDeployChecks(plan.plan.id, {});
assert(postCheck.ok, 'post-deploy checks pass');

const rollbackPlan = rollback.createRollbackPlan(plan.plan.id, { reason: 'Test rollback' }, {});
assert(rollbackPlan.ok, 'rollback plan created');

const rbProposal = rollback.createRollbackProposal(rollbackPlan.plan.id, {});
assert(rbProposal.ok, 'rollback proposal created');

rollback.approveRollbackProposal(rbProposal.proposal.id);
assert(rollback.createRollbackProposal(rollbackPlan.plan.id, {}).proposal.status === 'pending_approval', 'new rollback proposal pending');

// 2. Result router summary
const summary = resultRouter.getDeploySummary();
assert(summary.ok, 'deploy summary ok');
assert(summary.totalReleaseCandidates >= 1, 'summary has release candidates');

// 3. Utils
assert(typeof utils.shortId() === 'string', 'utils.shortId works');
assert(utils.maskSecrets('GITHUB_TOKEN=ghp_xxx') === 'GITHUB_TOKEN=[REDACTED]', 'utils.maskSecrets works');

console.log(`\n${'='.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
