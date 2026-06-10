'use strict';

/**
 * V3 Blueprint Dashboard Routes
 * Phase 75 - AI OS v3 Core Blueprint + Safe Modularization Plan
 */

const { requireDashboardAuth } = require('./dashboard-auth');
const { sanitizeError, sanitizeOutput } = require('./dashboard-serializers');

/**
 * Register V3 blueprint routes
 */
function registerV3BlueprintRoutes(app, services) {
  const v3BlueprintStore = services.v3BlueprintStore;
  const v3CoreBlueprintBuilder = services.v3CoreBlueprintBuilder;
  const v3ModuleContract = services.v3ModuleContract;
  const v3RegistryContractDraft = services.v3RegistryContractDraft;
  const v3DashboardShellPlan = services.v3DashboardShellPlan;
  const v3ApiContractDraft = services.v3ApiContractDraft;
  const v3CommandCapabilityPlan = services.v3CommandCapabilityPlan;
  const v3StorageBoundaryPlan = services.v3StorageBoundaryPlan;
  const v3WorkflowDevicePluginConvergencePlan = services.v3WorkflowDevicePluginConvergencePlan;
  const v3MigrationSliceValidator = services.v3MigrationSliceValidator;
  const v3BlueprintReadinessPrecheck = services.v3BlueprintReadinessPrecheck;
  const v3BlueprintReportGenerator = services.v3BlueprintReportGenerator;

  // Overview
  app.get('/api/dashboard/v3-blueprint', requireDashboardAuth, async (req, res) => {
    try {
      const overview = {
        status: 'planning',
        coreBlueprint: 'defined',
        moduleContracts: 'defined',
        registryDraft: 'defined',
        dashboardShellPlan: 'defined',
        apiContractDraft: 'defined',
        governancePlan: 'defined',
        storageBoundaryPlan: 'defined',
        convergencePlan: 'defined',
        readinessStatus: await v3BlueprintReadinessPrecheck?.runV3BlueprintReadinessPrecheck?.(services).then(r => r.overallStatus) || 'unknown'
      };

      res.json({
        ok: true,
        status: 'success',
        data: sanitizeOutput(overview),
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json(sanitizeError(error, 'v3-blueprint overview'));
    }
  });

  // Build blueprint
  app.post('/api/dashboard/v3-blueprint/build', requireDashboardAuth, async (req, res) => {
    try {
      const blueprint = await v3CoreBlueprintBuilder?.buildV3CoreBlueprint?.(services) || {};

      res.json({
        ok: true,
        status: 'success',
        message: 'V3 blueprint built successfully',
        data: sanitizeOutput(blueprint),
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json(sanitizeError(error, 'build v3 blueprint'));
    }
  });

  // Get core blueprint
  app.get('/api/dashboard/v3-blueprint/core', requireDashboardAuth, async (req, res) => {
    try {
      const core = await v3CoreBlueprintBuilder?.buildV3CoreBlueprint?.(services) || {};

      res.json({
        ok: true,
        status: 'success',
        data: sanitizeOutput(core),
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json(sanitizeError(error, 'v3 core blueprint'));
    }
  });

  // Get module contracts
  app.get('/api/dashboard/v3-blueprint/modules', requireDashboardAuth, async (req, res) => {
    try {
      const modules = await v3ModuleContract?.buildV3ModuleContractReport?.(services) || {};

      res.json({
        ok: true,
        status: 'success',
        data: sanitizeOutput(modules),
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json(sanitizeError(error, 'v3 module contracts'));
    }
  });

  // Get registry draft
  app.get('/api/dashboard/v3-blueprint/registry', requireDashboardAuth, async (req, res) => {
    try {
      const registry = await v3RegistryContractDraft?.draftRegistryV3Contract?.(services) || {};

      res.json({
        ok: true,
        status: 'success',
        data: sanitizeOutput(registry),
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json(sanitizeError(error, 'v3 registry draft'));
    }
  });

  // Get dashboard shell plan
  app.get('/api/dashboard/v3-blueprint/dashboard-shell', requireDashboardAuth, async (req, res) => {
    try {
      const dashboardShell = await v3DashboardShellPlan?.createDashboardV3ShellPlan?.(services) || {};

      res.json({
        ok: true,
        status: 'success',
        data: sanitizeOutput(dashboardShell),
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json(sanitizeError(error, 'v3 dashboard shell plan'));
    }
  });

  // Get API contract draft
  app.get('/api/dashboard/v3-blueprint/api-contract', requireDashboardAuth, async (req, res) => {
    try {
      const apiContract = await v3ApiContractDraft?.draftDashboardApiContractV3?.(services) || {};

      res.json({
        ok: true,
        status: 'success',
        data: sanitizeOutput(apiContract),
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json(sanitizeError(error, 'v3 api contract'));
    }
  });

  // Get governance plan
  app.get('/api/dashboard/v3-blueprint/governance', requireDashboardAuth, async (req, res) => {
    try {
      const governance = await v3CommandCapabilityPlan?.createCommandCapabilityV3Plan?.(services) || {};

      res.json({
        ok: true,
        status: 'success',
        data: sanitizeOutput(governance),
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json(sanitizeError(error, 'v3 governance plan'));
    }
  });

  // Get storage boundary plan
  app.get('/api/dashboard/v3-blueprint/storage', requireDashboardAuth, async (req, res) => {
    try {
      const storage = await v3StorageBoundaryPlan?.createStorageBoundaryV3Plan?.(services) || {};

      res.json({
        ok: true,
        status: 'success',
        data: sanitizeOutput(storage),
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json(sanitizeError(error, 'v3 storage boundary plan'));
    }
  });

  // Get convergence plan
  app.get('/api/dashboard/v3-blueprint/convergence', requireDashboardAuth, async (req, res) => {
    try {
      const convergence = await v3WorkflowDevicePluginConvergencePlan?.createConvergencePlanV3?.(services) || {};

      res.json({
        ok: true,
        status: 'success',
        data: sanitizeOutput(convergence),
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json(sanitizeError(error, 'v3 convergence plan'));
    }
  });

  // Validate migration slice
  app.post('/api/dashboard/v3-blueprint/validate-slice', requireDashboardAuth, async (req, res) => {
    try {
      const slice = req.body;
      const validation = await v3MigrationSliceValidator?.validateV3MigrationSlice?.(slice, services) || {};

      res.json({
        ok: true,
        status: 'success',
        message: 'Migration slice validated',
        data: sanitizeOutput(validation),
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json(sanitizeError(error, 'validate migration slice'));
    }
  });

  // Get readiness precheck
  app.get('/api/dashboard/v3-blueprint/readiness', requireDashboardAuth, async (req, res) => {
    try {
      const readiness = await v3BlueprintReadinessPrecheck?.runV3BlueprintReadinessPrecheck?.(services) || {};

      res.json({
        ok: true,
        status: 'success',
        data: sanitizeOutput(readiness),
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json(sanitizeError(error, 'v3 readiness precheck'));
    }
  });

  // Full V3 blueprint report
  app.get('/api/dashboard/v3-blueprint/report', requireDashboardAuth, async (req, res) => {
    try {
      const report = await v3BlueprintReportGenerator?.buildV3BlueprintReport?.(services) || {};

      res.json({
        ok: true,
        status: 'success',
        data: sanitizeOutput(report),
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json(sanitizeError(error, 'v3 blueprint report'));
    }
  });
}

module.exports = { registerV3BlueprintRoutes };
