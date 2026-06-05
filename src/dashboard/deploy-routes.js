'use strict';

const express = require('express');
const deploy = require('../deploy');
const guards = require('./dashboard-guards');

function registerDeployRoutes(router, services) {
  const dr = express.Router();

  dr.get('/', (req, res) => {
    const summary = deploy.deployResultRouter.getDeploySummary(services);
    return guards.safeDashboardResponse(res, summary);
  });

  dr.get('/release-candidates', (req, res) => {
    const filters = req.query;
    const result = deploy.releaseCandidateManager.listReleaseCandidates(filters);
    return guards.safeDashboardResponse(res, result);
  });

  dr.post('/release-candidates', (req, res) => {
    const input = req.body || {};
    const result = deploy.releaseCandidateManager.createReleaseCandidate(input, services);
    return guards.safeDashboardResponse(res, result);
  });

  dr.post('/render-gate', (req, res) => {
    const { releaseCandidateId } = req.body || {};
    const result = deploy.renderDeployGate.runRenderDeployGate(releaseCandidateId, services);
    return guards.safeDashboardResponse(res, result);
  });

  dr.get('/env-check', (req, res) => {
    const required = deploy.renderEnvChecker.checkRenderRequiredEnvNames(services);
    const optional = deploy.renderEnvChecker.checkRenderOptionalEnvNames(services);
    const risks = deploy.renderEnvChecker.detectEnvCrashRisk(services);
    return guards.safeDashboardResponse(res, { ok: true, required, optional, risks });
  });

  dr.post('/startup-check', (req, res) => {
    const result = deploy.renderStartupChecker.buildStartupCheckReport(services);
    return guards.safeDashboardResponse(res, result);
  });

  dr.post('/plan', (req, res) => {
    const { releaseCandidateId, target } = req.body || {};
    if (!releaseCandidateId) return guards.safeDashboardResponse(res, { ok: false, error: 'releaseCandidateId required' }, 400);
    const result = deploy.deployPlanGenerator.createDeployPlan(releaseCandidateId, target, services);
    return guards.safeDashboardResponse(res, result);
  });

  dr.post('/proposal', (req, res) => {
    const { deployPlanId } = req.body || {};
    if (!deployPlanId) return guards.safeDashboardResponse(res, { ok: false, error: 'deployPlanId required' }, 400);
    const result = deploy.deployProposalBuilder.createDeployProposal(deployPlanId, services);
    return guards.safeDashboardResponse(res, result);
  });

  dr.post('/post-check', (req, res) => {
    const { deployPlanId } = req.body || {};
    const result = deploy.postDeployMonitor.runPostDeployChecks(deployPlanId, services);
    return guards.safeDashboardResponse(res, result);
  });

  dr.post('/rollback-plan', (req, res) => {
    const { deployPlanId, failureReport } = req.body || {};
    if (!deployPlanId) return guards.safeDashboardResponse(res, { ok: false, error: 'deployPlanId required' }, 400);
    const result = deploy.rollbackPlanGenerator.createRollbackPlan(deployPlanId, failureReport, services);
    return guards.safeDashboardResponse(res, result);
  });

  dr.post('/rollback-proposal', (req, res) => {
    const { rollbackPlanId } = req.body || {};
    if (!rollbackPlanId) return guards.safeDashboardResponse(res, { ok: false, error: 'rollbackPlanId required' }, 400);
    const result = deploy.rollbackPlanGenerator.createRollbackProposal(rollbackPlanId, services);
    return guards.safeDashboardResponse(res, result);
  });

  dr.get('/release-gate', (req, res) => {
    const releaseGates = deploy.store.getReleaseGates();
    const deployGates = deploy.store.getDeployGates();
    return guards.safeDashboardResponse(res, {
      ok: true,
      releaseGates: releaseGates.slice(-5),
      deployGates: deployGates.slice(-5),
      timestamp: new Date().toISOString()
    });
  });

  router.use('/deploy', dr);
}

module.exports = { registerDeployRoutes };
