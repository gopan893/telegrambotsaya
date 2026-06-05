'use strict';

const express = require('express');
const githubops = require('../githubops');
const guards = require('./dashboard-guards');

function registerGithubOpsRoutes(router, services) {
  const ghRouter = express.Router();

  ghRouter.get('/repo-state', (req, res) => {
    const state = githubops.repoState.getGitRepoState(services);
    return guards.safeDashboardResponse(res, state);
  });

  ghRouter.get('/change-manifest', (req, res) => {
    const repoState = githubops.repoState.getGitRepoState(services);
    if (!repoState.ok) return guards.safeDashboardResponse(res, repoState);
    const manifest = githubops.changeManifest.buildGitChangeManifest(repoState);
    return guards.safeDashboardResponse(res, { ok: true, manifest });
  });

  ghRouter.post('/secret-scan', (req, res) => {
    const repoState = githubops.repoState.getGitRepoState(services);
    if (!repoState.ok) return guards.safeDashboardResponse(res, repoState);
    const manifest = githubops.changeManifest.buildGitChangeManifest(repoState);
    const diff = repoState.summary || '';
    const report = githubops.secretScan.runSecretScan(manifest.files, diff, services);
    return guards.safeDashboardResponse(res, report);
  });

  ghRouter.post('/commit-plan', (req, res) => {
    const repoState = githubops.repoState.getGitRepoState(services);
    if (!repoState.ok) return guards.safeDashboardResponse(res, repoState);
    const manifest = githubops.changeManifest.buildGitChangeManifest(repoState);
    const result = githubops.commitPlan.createCommitPlan(manifest);
    return guards.safeDashboardResponse(res, result);
  });

  ghRouter.post('/push-plan', (req, res) => {
    const repoState = githubops.repoState.getGitRepoState(services);
    if (!repoState.ok) return guards.safeDashboardResponse(res, repoState);
    const manifest = githubops.changeManifest.buildGitChangeManifest(repoState);
    const commitPlanResult = githubops.commitPlan.createCommitPlan(manifest);
    if (!commitPlanResult.ok) return guards.safeDashboardResponse(res, commitPlanResult);
    const result = githubops.pushPlan.createPushPlan(commitPlanResult);
    return guards.safeDashboardResponse(res, result);
  });

  ghRouter.post('/push-proposal', (req, res) => {
    const repoState = githubops.repoState.getGitRepoState(services);
    if (!repoState.ok) return guards.safeDashboardResponse(res, repoState);
    const manifest = githubops.changeManifest.buildGitChangeManifest(repoState);
    const commitPlanResult = githubops.commitPlan.createCommitPlan(manifest);
    if (!commitPlanResult.ok) return guards.safeDashboardResponse(res, commitPlanResult);
    const pushPlanResult = githubops.pushPlan.createPushPlan(commitPlanResult);
    if (!pushPlanResult.ok) return guards.safeDashboardResponse(res, pushPlanResult);
    pushPlanResult.plan.secretScanPassed = true;
    const proposal = githubops.pushProposal.createPushProposal(pushPlanResult);
    return guards.safeDashboardResponse(res, proposal);
  });

  ghRouter.post('/push-proposal/:id/approve', (req, res) => {
    const { executorId } = req.body || {};
    const result = githubops.pushProposal.approvePushProposal(req.params.id, executorId || 'dashboard-admin', services);
    return guards.safeDashboardResponse(res, result);
  });

  ghRouter.post('/push-proposal/:id/reject', (req, res) => {
    const { reason, executorId } = req.body || {};
    const result = githubops.pushProposal.rejectPushProposal(req.params.id, reason || 'Rejected via dashboard', executorId || 'dashboard-admin');
    return guards.safeDashboardResponse(res, result);
  });

  ghRouter.get('/push-proposals', (req, res) => {
    const filters = req.query;
    const proposals = githubops.pushProposal.listPushProposals(filters);
    return guards.safeDashboardResponse(res, { ok: true, proposals });
  });

  ghRouter.get('/workflows', (req, res) => {
    const workflows = githubops.workflowRunProposal.listAvailableWorkflows(services);
    return guards.safeDashboardResponse(res, { ok: true, workflows });
  });

  ghRouter.post('/workflow-run-proposal', (req, res) => {
    const { workflow, ref } = req.body || {};
    if (!workflow) return guards.safeDashboardResponse(res, { ok: false, error: 'Workflow name required' }, 400);
    const result = githubops.workflowRunProposal.createWorkflowRunProposal(workflow, ref || 'main', services);
    return guards.safeDashboardResponse(res, result);
  });

  ghRouter.post('/workflow-run-proposal/:id/approve', (req, res) => {
    const { executorId } = req.body || {};
    const result = githubops.workflowRunProposal.approveWorkflowRunProposal(req.params.id, executorId || 'dashboard-admin');
    return guards.safeDashboardResponse(res, result);
  });

  ghRouter.post('/workflow-run-proposal/:id/reject', (req, res) => {
    const { reason, executorId } = req.body || {};
    const result = githubops.workflowRunProposal.rejectWorkflowRunProposal(req.params.id, reason || 'Rejected via dashboard', executorId || 'dashboard-admin');
    return guards.safeDashboardResponse(res, result);
  });

  ghRouter.get('/workflow-run-proposals', (req, res) => {
    const filters = req.query;
    const proposals = githubops.workflowRunProposal.listWorkflowRunProposals(filters);
    return guards.safeDashboardResponse(res, { ok: true, proposals });
  });

  ghRouter.post('/pipeline', (req, res) => {
    const pipeline = require('../githubops/githubops-pipeline');
    const result = pipeline.runFullPipeline(services);
    return guards.safeDashboardResponse(res, result);
  });

  ghRouter.get('/pipeline-summary', (req, res) => {
    const pipeline = require('../githubops/githubops-pipeline');
    const repoState = githubops.repoState.getGitRepoState(services);
    if (!repoState.ok) return guards.safeDashboardResponse(res, { ok: false, error: repoState.error });
    const manifest = githubops.changeManifest.buildGitChangeManifest(repoState);
    const result = pipeline.getPipelineSummary({
      ok: true,
      repoState,
      manifest,
      secretScan: githubops.store.getSecretScan() || { blocked: false },
      commitPlan: githubops.commitPlan.createCommitPlan(manifest),
      pushPlan: githubops.pushPlan.createPushPlan(githubops.commitPlan.createCommitPlan(manifest)),
      proposal: githubops.pushProposal.createPushProposal(githubops.pushPlan.createPushPlan(githubops.commitPlan.createCommitPlan(manifest)))
    });
    return guards.safeDashboardResponse(res, result);
  });

  ghRouter.get('/release-gate', (req, res) => {
    const pushProposals = githubops.store.getPushProposals();
    const workflowProposals = githubops.store.getWorkflowRunProposals();
    const releaseGate = require('../githubops/github-release-gate');
    const gate = releaseGate.evaluateReleaseReadiness(
      { pushProposals, workflowProposals },
      'success'
    );
    return guards.safeDashboardResponse(res, gate);
  });

  router.use('/githubops', ghRouter);
}

module.exports = { registerGithubOpsRoutes };
