'use strict';

const utils = require('./deploy-utils');
const store = require('./deploy-release-store');
const envChecker = require('./render-env-checker');
const startupChecker = require('./render-startup-checker');
const deployGate = require('./render-deploy-gate');

function createDeployPlan(releaseCandidateId, target, services) {
  const rc = store.getReleaseCandidates().find(c => c.id === releaseCandidateId);
  if (!rc) return { ok: false, error: 'Release candidate not found' };

  const id = utils.shortId();
  const envRisk = envChecker.detectEnvCrashRisk(services);
  const startupReport = startupChecker.buildStartupCheckReport(services);
  const gateResult = deployGate.runRenderDeployGate(releaseCandidateId, services);

  const blockers = [];
  if (!envRisk.ok) blockers.push('Missing required env vars');
  if (!startupReport.ok) blockers.push('Startup checks failed');
  if (!gateResult.ok) blockers.push('Render deploy gate failed');

  const plan = {
    id,
    releaseCandidateId,
    targetProvider: target?.provider || 'render',
    environment: target?.environment || 'production',
    branch: rc.branch,
    commitSha: rc.commitSha,
    requiredChecks: ['startup_check', 'env_check', 'deploy_gate', 'secret_scan', 'eval_v2', 'executor_approval'],
    blockers,
    warnings: [
      envRisk.degraded?.length ? `Degraded features: ${envRisk.degraded.length}` : null,
      rc.branch === 'main' ? 'Deploying from main branch' : null
    ].filter(Boolean),
    riskLevel: rc.branch === 'main' ? 'medium' : 'low',
    evaluationRequired: true,
    executorApprovalRequired: true,
    status: 'draft',
    createdAt: utils.now()
  };

  store.addDeployPlan(plan);
  store.addReleaseGate(gateResult);
  return { ok: true, plan };
}

function validateDeployReadiness(deployPlan, services) {
  if (!deployPlan) return { ok: false, error: 'No plan' };
  const checks = deployPlan.requiredChecks || [];
  const ready = deployPlan.blockers.length === 0 && deployPlan.status !== 'failed';
  return {
    ok: ready,
    ready,
    pendingChecks: ready ? [] : deployPlan.blockers,
    note: ready ? 'Ready for proposal' : 'Blockers remain'
  };
}

function buildDeployRiskSummary(deployPlan) {
  if (!deployPlan) return 'No deploy plan data.';
  const lines = ['## Deploy Risk Summary', ''];
  lines.push(`- Environment: **${deployPlan.environment}**`);
  lines.push(`- Target: **${deployPlan.targetProvider}**`);
  lines.push(`- Branch: **${deployPlan.branch}**`);
  lines.push(`- Risk Level: **${deployPlan.riskLevel}**`);
  lines.push(`- Blockers: ${deployPlan.blockers.length ? '❌ ' + deployPlan.blockers.join(', ') : '✅ None'}`);
  lines.push(`- Evaluation Required: ${deployPlan.evaluationRequired}`);
  lines.push(`- Executor Approval Required: ${deployPlan.executorApprovalRequired}`);
  lines.push('');
  lines.push(`Status: **${deployPlan.status}**`);
  return lines.join('\n');
}

function buildDeployManualInstructions(deployPlan) {
  if (!deployPlan) return 'No deploy plan.';
  const provider = deployPlan.targetProvider || 'render';
  return [
    `# Deploy Instructions (${provider})`,
    '',
    '## Prerequisites',
    '- Release gate passed',
    '- Evaluation v2 passed',
    '- Executor proposal approved',
    '',
    '## Steps',
    '1. Push to GitHub (triggers auto-deploy on Render)',
    '2. Monitor Render dashboard for build status',
    '3. Verify health endpoint after deploy',
    '4. Run post-deploy checks',
    '',
    '## Rollback',
    'If deploy fails, use rollback plan.',
    '- git revert to last known good commit',
    '- Push reverted commit',
    '- Render auto-deploys the revert'
  ].join('\n');
}

module.exports = {
  createDeployPlan,
  validateDeployReadiness,
  buildDeployRiskSummary,
  buildDeployManualInstructions
};
