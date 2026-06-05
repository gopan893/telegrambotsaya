'use strict';

const store = require('./githubops-store');
const repoState = require('./github-repo-state');
const changeManifest = require('./git-change-manifest');
const secretScan = require('./git-secret-scan');
const commitPlan = require('./git-commit-plan');
const pushPlan = require('./git-push-plan');
const pushProposal = require('./git-push-proposal');
const workflowRunProposal = require('./workflow-run-proposal');
const monitor = require('./github-actions-monitor');
const releaseGate = require('./github-release-gate');
const utils = require('./githubops-utils');

function runFullPipeline(services) {
  store.clear();

  const state = repoState.getGitRepoState(services);
  if (!state.ok) return { ok: false, step: 'repoState', error: state.error };

  const manifest = changeManifest.buildGitChangeManifest(state);
  if (!manifest || !manifest.totalChanged) return { ok: false, step: 'manifest', error: 'No changes detected' };

  const scanReport = secretScan.runSecretScan(manifest.files, state.summary, services);
  if (scanReport.blocked) return { ok: false, step: 'secretScan', error: 'Secrets detected', report: scanReport };

  const commitPlanResult = commitPlan.createCommitPlan(manifest);
  if (!commitPlanResult.ok) return { ok: false, step: 'commitPlan', error: commitPlanResult.error };

  const pushPlanResult = pushPlan.createPushPlan(commitPlanResult);
  if (!pushPlanResult.ok) return { ok: false, step: 'pushPlan', error: pushPlanResult.error };

  pushPlanResult.plan.secretScanPassed = true;
  store.setPushPlan(pushPlanResult.plan);

  const proposalResult = pushProposal.createPushProposal(pushPlanResult);
  if (!proposalResult.ok) return { ok: false, step: 'pushProposal', error: proposalResult.error };

  return {
    ok: true,
    steps: ['repoState', 'manifest', 'secretScan', 'commitPlan', 'pushPlan', 'pushProposal'],
    repoState: state,
    manifest,
    secretScan: scanReport,
    commitPlan: commitPlanResult.plan,
    pushPlan: pushPlanResult.plan,
    proposal: proposalResult.proposal
  };
}

function getPipelineSummary(pipelineResult) {
  if (!pipelineResult || !pipelineResult.ok) return { ok: false, error: pipelineResult?.error || 'Pipeline not run' };
  return {
    ok: true,
    branch: pipelineResult.repoState?.branch,
    totalChanges: pipelineResult.manifest?.totalChanged,
    secretScanPassed: !pipelineResult.secretScan?.blocked,
    commitPlanId: pipelineResult.commitPlan?.id,
    pushPlanId: pipelineResult.pushPlan?.id,
    proposalId: pipelineResult.proposal?.id,
    proposalStatus: pipelineResult.proposal?.status
  };
}

module.exports = {
  runFullPipeline,
  getPipelineSummary
};
