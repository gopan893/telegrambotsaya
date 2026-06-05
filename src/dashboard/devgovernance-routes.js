'use strict';

const express = require('express');
const devGov = require('../devgovernance');
const guards = require('./dashboard-guards');

function registerDevGovernanceRoutes(router, services) {
  const devGovRouter = express.Router();

  devGovRouter.get('/', (req, res) => {
    const contractStatus = devGov.contractManager.getAgentContractSummary(services);
    const handoffSummary = devGov.handoffOrchestrator.generateHandoffSummary(services);
    const archStatus = devGov.architectureMapGenerator.getArchitectureMapStatus(services);

    return guards.safeDashboardResponse(res, {
      ok: true,
      contract: contractStatus.ok ? { exists: true, valid: contractStatus.validation?.ok } : { exists: false },
      handoff: handoffSummary.ok ? {
        lastAgent: handoffSummary.summary.lastAgent,
        currentTask: handoffSummary.summary.currentTask,
        testsFailed: handoffSummary.summary.testsFailed,
        testsSkipped: handoffSummary.summary.testsSkipped
      } : null,
      architecture: archStatus,
      generatedAt: new Date().toISOString()
    });
  });

  devGovRouter.get('/contract', (req, res) => {
    const result = devGov.contractManager.getAgentContractSummary(services);
    return guards.safeDashboardResponse(res, result);
  });

  devGovRouter.get('/handoff', (req, res) => {
    const result = devGov.handoffOrchestrator.generateHandoffSummary(services);
    return guards.safeDashboardResponse(res, result);
  });

  devGovRouter.post('/handoff', (req, res) => {
    const { handoff } = req.body || {};
    if (!handoff) return guards.safeDashboardResponse(res, { ok: false, error: 'Handoff data required' }, 400);
    const result = devGov.handoffOrchestrator.writeHandoff(handoff, services);
    return guards.safeDashboardResponse(res, result);
  });

  devGovRouter.post('/scan', (req, res) => {
    const archResult = devGov.architectureMapGenerator.generateArchitectureMap(services);
    const contractResult = devGov.contractManager.ensureAgentContractExists(services);
    return guards.safeDashboardResponse(res, {
      ok: true,
      architectureMap: { path: archResult.path, ok: true },
      contract: contractResult,
      timestamp: new Date().toISOString()
    });
  });

  devGovRouter.get('/architecture-map', (req, res) => {
    const scan = devGov.architectureMapGenerator.scanArchitecture(services);
    return guards.safeDashboardResponse(res, { ok: true, scan });
  });

  devGovRouter.get('/integration-contract', (req, res) => {
    const stored = devGov.store.getIntegrationContract(services);
    if (stored) return guards.safeDashboardResponse(res, { ok: true, contract: stored });
    const result = devGov.integrationContractValidator.validateIntegrationContract(services);
    return guards.safeDashboardResponse(res, { ok: true, contract: result });
  });

  devGovRouter.post('/validate', (req, res) => {
    const result = devGov.integrationContractValidator.validateIntegrationContract(services);
    return guards.safeDashboardResponse(res, { ok: true, result });
  });

  devGovRouter.get('/collisions', (req, res) => {
    const stored = devGov.store.getCollisionReports(services);
    const report = stored.length ? stored[stored.length - 1] : null;
    if (report) return guards.safeDashboardResponse(res, { ok: true, collisions: report });
    const result = devGov.collisionDetector.detectCollisions(services);
    return guards.safeDashboardResponse(res, { ok: true, collisions: result });
  });

  devGovRouter.get('/dashboard-routes', (req, res) => {
    const stored = devGov.store.getDashboardRouteReports(services);
    const report = stored.length ? stored[stored.length - 1] : null;
    if (report) return guards.safeDashboardResponse(res, { ok: true, dashboardRoutes: report });
    const result = devGov.dashboardRouteConsistency.validateDashboardRoutes(services);
    return guards.safeDashboardResponse(res, { ok: true, dashboardRoutes: result });
  });

  devGovRouter.get('/backend-frontend', (req, res) => {
    const stored = devGov.store.getBackendFrontendReports(services);
    const report = stored.length ? stored[stored.length - 1] : null;
    if (report) return guards.safeDashboardResponse(res, { ok: true, backendFrontend: report });
    const result = devGov.backendFrontendLinker.generateLinkReport(services);
    return guards.safeDashboardResponse(res, { ok: true, backendFrontend: result });
  });

  devGovRouter.post('/test-matrix', (req, res) => {
    const { changeManifest: manifest } = req.body || {};
    const matrix = devGov.testMatrixGenerator.generateTestMatrix(manifest || null);
    return guards.safeDashboardResponse(res, { ok: true, matrix });
  });

  devGovRouter.post('/next-agent-prompt', (req, res) => {
    const { type, context } = req.body || {};
    const result = devGov.nextAgentPromptGenerator.generateNextAgentPrompt(type || 'codex', context || { services });
    return guards.safeDashboardResponse(res, result);
  });

  router.use('/devgovernance', devGovRouter);
}

module.exports = { registerDevGovernanceRoutes };
