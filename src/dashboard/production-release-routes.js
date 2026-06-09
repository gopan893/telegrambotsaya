'use strict';

const express = require('express');
const guards = require('./dashboard-guards');
const release = require('../release');

function sanitize(obj) {
  if (!obj) return null;
  return { ...obj };
}

function registerProductionReleaseRoutes(router, services = {}) {
  const prodStore = release.productionReleaseStore || release;

  router.get('/production-release', (req, res) => {
    const all = prodStore.listProductionReleases ? prodStore.listProductionReleases() : [];
    const latest = prodStore.getLatestProductionRelease ? prodStore.getLatestProductionRelease() : null;
    return guards.safeDashboardResponse(res, {
      ok: true,
      releases: all.map(sanitize),
      latest: sanitize(latest),
      count: all.length
    });
  });

  router.post('/production-release/create', (req, res) => {
    const input = {
      workspaceId: req.body.workspaceId || 'default',
      version: req.body.version || 'v1.0.0',
      sourceRcVersion: req.body.sourceRcVersion || 'v1.0.0-rc.1'
    };
    const mgr = release.ProductionReleaseManager;
    const r = mgr.createProductionRelease(input, services);
    return guards.safeDashboardResponse(res, { ok: true, release: sanitize(r) });
  });

  router.post('/production-release/:id/readiness', (req, res) => {
    const mgr = release.ProductionReleaseManager;
    const result = mgr.finalizeProductionReleasePlan(req.params.id, services);
    return guards.safeDashboardResponse(res, { ok: result.ok, release: sanitize(result.release), blockers: result.blockers || [], warnings: result.warnings || [], status: result.status || 'unknown' });
  });

  router.get('/production-release/:id/rollout-plan', (req, res) => {
    const planner = release.ReleaseRolloutPlanner;
    const plan = planner.createReleaseRolloutPlan(req.params.id, services);
    const preDeploy = planner.createPreDeployChecklist(req.params.id, services);
    const verification = planner.createDeployVerificationChecklist(req.params.id, services);
    const rollbackPlan = planner.createRollbackRehearsalPlan(req.params.id, services);
    const postReleasePlan = planner.createPostReleaseMonitoringPlan(req.params.id, services);
    return guards.safeDashboardResponse(res, { ok: true, plan, preDeploy, verification, rollbackPlan, postReleasePlan });
  });

  router.post('/production-release/:id/github-proposal', (req, res) => {
    const builder = release.GitHubReleaseProposalBuilder;
    const tagProposal = builder.buildGitHubTagProposal(req.params.id, services);
    const releaseProposal = builder.buildGitHubReleaseProposal(req.params.id, services);
    const notes = builder.buildReleaseNotesForGitHub(req.params.id, services);
    return guards.safeDashboardResponse(res, { ok: true, tagProposal, releaseProposal, notes, proposalOnly: true, requiresEvaluation: true, requiresApproval: true });
  });

  router.post('/production-release/:id/deploy-proposal', (req, res) => {
    const builder = release.ProductionDeployProposalBuilder;
    const deployProposal = builder.buildProductionDeployProposal(req.params.id, services);
    const renderProposal = builder.buildRenderDeployProposal(req.params.id, services);
    const smokeTest = builder.buildDeploySmokeTestPlan(req.params.id, services);
    return guards.safeDashboardResponse(res, { ok: true, deployProposal, renderProposal, smokeTest, proposalOnly: true, requiresEvaluation: true, requiresApproval: true });
  });

  router.get('/production-release/:id/verification', (req, res) => {
    const checker = release.ReleaseVerificationChecker;
    const boot = checker.verifyProductionBoot(services);
    const dashboard = checker.verifyDashboardAfterRelease(services);
    const telegram = checker.verifyTelegramAfterRelease(services);
    const webhook = checker.verifyWebhookHealth(services);
    const storage = checker.verifyStorageHealth(services);
    const api = checker.verifyCriticalApiHealth(services);
    const secrets = checker.verifyNoSecretLeakInReleaseOutputs(services);
    const report = checker.buildReleaseVerificationReport({ boot, dashboard, telegram, webhook, storage, api, secrets });
    return guards.safeDashboardResponse(res, { ok: true, ...report });
  });

  router.get('/production-release/:id/report', (req, res) => {
    const mgr = release.ProductionReleaseManager;
    const summary = mgr.buildProductionReleaseSummary(req.params.id, services);
    const gate = release.RolloutReadinessGate;
    const readiness = gate.runRolloutReadinessGate(req.params.id, services);
    const announcer = release.ReleaseAnnouncementGenerator;
    const announcement = announcer.generateReleaseAnnouncement(req.params.id, services);
    return guards.safeDashboardResponse(res, { ok: true, summary, readiness, announcement });
  });
}

module.exports = { registerProductionReleaseRoutes };
