'use strict';

/**
 * Registry v3 Dashboard Routes
 * Phase 76 - Registry Contract Freeze + Route Generation Plan
 */

const { requireDashboardAuth } = require('./dashboard-auth');
const { sanitizeError, sanitizeOutput } = require('./dashboard-serializers');

function registerRegistryV3Routes(router, services) {
  const store = services.registryV3Store || require('../registry-v3/registry-v3-store');
  const contract = services.registryV3Contract || require('../registry-v3/registry-v3-contract');
  const freezeManager = services.registryV3FreezeManager || require('../registry-v3/registry-v3-freeze-manager');
  const versionManager = services.registryV3VersionManager || require('../registry-v3/registry-v3-version-manager');
  const validator = services.registryV3Validator || require('../registry-v3/registry-v3-validator');
  const conflictDetector = services.registryV3ConflictDetector || require('../registry-v3/registry-v3-conflict-detector');
  const compatBridge = services.registryV3CompatBridge || require('../registry-v3/registry-v3-compatibility-bridge');
  const migrationBlocker = services.registryV3MigrationBlocker || require('../registry-v3/registry-v3-migration-blocker-detector');
  const reportGenerator = services.registryV3ReportGenerator || require('../registry-v3/registry-v3-report-generator');
  const tabContract = require('../route-generation/dashboard-tab-contract-v3');
  const apiContract = require('../route-generation/dashboard-api-contract-v3');
  const rendererContract = require('../route-generation/dashboard-renderer-contract-v3');
  const commandContract = require('../route-generation/telegram-command-contract-v3');
  const capabilityContract = require('../route-generation/capability-contract-v3');
  const aliasContract = require('../route-generation/alias-contract-v3');
  const routePlanner = require('../route-generation/dashboard-route-generation-planner');
  const routePreview = require('../route-generation/dashboard-route-preview-builder');
  const sidebarPreview = require('../route-generation/dashboard-sidebar-preview-builder');
  const mobileNavPreview = require('../route-generation/dashboard-mobile-nav-preview-builder');
  const contentValidator = require('../route-generation/dashboard-content-contract-validator');
  const genReport = require('../route-generation/dashboard-generation-report-generator');

  // GET /api/dashboard/registry-v3 - Main overview
  router.get('/registry-v3', requireDashboardAuth, async (req, res) => {
    try {
      const status = store.getStatus();
      const freezeStatus = freezeManager.getRegistryV3FreezeStatus({ ...services, store });
      const version = versionManager.getCurrentRegistryV3Version({ ...services, store });
      const validation = await validator.validateRegistryV3Contract(
        store.getFrozen() || store.getDraft(), { ...services, store }
      );
      const conflicts = conflictDetector.detectRegistryV3Conflicts({ ...services, store });
      const compatReport = compatBridge.buildRegistryV3CompatibilityReport({ ...services, store });
      const blockers = migrationBlocker.detectRegistryV3MigrationBlockers({ ...services, store });

      res.json({
        ok: true,
        status: 'success',
        data: sanitizeOutput({
          registryStatus: status,
          freezeStatus,
          version,
          validation,
          conflicts,
          compatibility: compatReport,
          migrationBlockers: blockers
        }),
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json(sanitizeError(error, 'registry-v3 overview'));
    }
  });

  // POST /api/dashboard/registry-v3/draft - Create draft
  router.post('/registry-v3/draft', requireDashboardAuth, async (req, res) => {
    try {
      const result = await freezeManager.createRegistryV3Draft({ ...services, store });
      res.json({
        ok: true,
        status: 'success',
        data: sanitizeOutput(result)
      });
    } catch (error) {
      res.status(500).json(sanitizeError(error, 'registry-v3 draft creation'));
    }
  });

  // POST /api/dashboard/registry-v3/freeze - Freeze contract
  router.post('/registry-v3/freeze', requireDashboardAuth, async (req, res) => {
    try {
      const result = await freezeManager.freezeRegistryV3Contract(req.body, { ...services, store });
      res.json({
        ok: result.success,
        status: result.success ? 'success' : 'error',
        data: sanitizeOutput(result)
      });
    } catch (error) {
      res.status(500).json(sanitizeError(error, 'registry-v3 freeze'));
    }
  });

  // GET /api/dashboard/registry-v3/status - Freeze status
  router.get('/registry-v3/status', requireDashboardAuth, async (req, res) => {
    try {
      const result = freezeManager.getRegistryV3FreezeStatus({ ...services, store });
      res.json({ ok: true, status: 'success', data: sanitizeOutput(result) });
    } catch (error) {
      res.status(500).json(sanitizeError(error, 'registry-v3 status'));
    }
  });

  // GET /api/dashboard/registry-v3/version - Version info
  router.get('/registry-v3/version', requireDashboardAuth, async (req, res) => {
    try {
      const result = versionManager.buildRegistryV3VersionReport({ ...services, store });
      res.json({ ok: true, status: 'success', data: sanitizeOutput(result) });
    } catch (error) {
      res.status(500).json(sanitizeError(error, 'registry-v3 version'));
    }
  });

  // POST /api/dashboard/registry-v3/validate - Run validation
  router.post('/registry-v3/validate', requireDashboardAuth, async (req, res) => {
    try {
      const frozen = store.getFrozen() || store.getDraft();
      const result = await validator.validateRegistryV3Contract(frozen, { ...services, store });
      res.json({ ok: true, status: 'success', data: sanitizeOutput(result) });
    } catch (error) {
      res.status(500).json(sanitizeError(error, 'registry-v3 validation'));
    }
  });

  // GET /api/dashboard/registry-v3/conflicts - Conflict report
  router.get('/registry-v3/conflicts', requireDashboardAuth, async (req, res) => {
    try {
      const result = conflictDetector.detectRegistryV3Conflicts({ ...services, store });
      res.json({ ok: true, status: 'success', data: sanitizeOutput(result) });
    } catch (error) {
      res.status(500).json(sanitizeError(error, 'registry-v3 conflicts'));
    }
  });

  // GET /api/dashboard/registry-v3/compatibility - Compatibility report
  router.get('/registry-v3/compatibility', requireDashboardAuth, async (req, res) => {
    try {
      const result = compatBridge.buildRegistryV3CompatibilityReport({ ...services, store });
      res.json({ ok: true, status: 'success', data: sanitizeOutput(result) });
    } catch (error) {
      res.status(500).json(sanitizeError(error, 'registry-v3 compatibility'));
    }
  });

  // GET /api/dashboard/registry-v3/blockers - Migration blockers
  router.get('/registry-v3/blockers', requireDashboardAuth, async (req, res) => {
    try {
      const result = migrationBlocker.detectRegistryV3MigrationBlockers({ ...services, store });
      res.json({ ok: true, status: 'success', data: sanitizeOutput(result) });
    } catch (error) {
      res.status(500).json(sanitizeError(error, 'registry-v3 blockers'));
    }
  });

  // GET /api/dashboard/registry-v3/dashboard-tabs - Tab contracts
  router.get('/registry-v3/dashboard-tabs', requireDashboardAuth, async (req, res) => {
    try {
      const result = tabContract.buildDashboardTabContractReport({ ...services, store });
      res.json({ ok: true, status: 'success', data: sanitizeOutput(result) });
    } catch (error) {
      res.status(500).json(sanitizeError(error, 'registry-v3 dashboard tabs'));
    }
  });

  // GET /api/dashboard/registry-v3/apis - API contracts
  router.get('/registry-v3/apis', requireDashboardAuth, async (req, res) => {
    try {
      const result = apiContract.buildDashboardApiContractReport({ ...services, store });
      res.json({ ok: true, status: 'success', data: sanitizeOutput(result) });
    } catch (error) {
      res.status(500).json(sanitizeError(error, 'registry-v3 APIs'));
    }
  });

  // GET /api/dashboard/registry-v3/renderers - Renderer contracts
  router.get('/registry-v3/renderers', requireDashboardAuth, async (req, res) => {
    try {
      const result = rendererContract.buildRendererContractReport({ ...services, store });
      res.json({ ok: true, status: 'success', data: sanitizeOutput(result) });
    } catch (error) {
      res.status(500).json(sanitizeError(error, 'registry-v3 renderers'));
    }
  });

  // GET /api/dashboard/registry-v3/commands - Command contracts
  router.get('/registry-v3/commands', requireDashboardAuth, async (req, res) => {
    try {
      const result = commandContract.buildTelegramCommandContractReport({ ...services, store });
      res.json({ ok: true, status: 'success', data: sanitizeOutput(result) });
    } catch (error) {
      res.status(500).json(sanitizeError(error, 'registry-v3 commands'));
    }
  });

  // GET /api/dashboard/registry-v3/capabilities - Capability contracts
  router.get('/registry-v3/capabilities', requireDashboardAuth, async (req, res) => {
    try {
      const result = capabilityContract.buildCapabilityContractReport({ ...services, store });
      res.json({ ok: true, status: 'success', data: sanitizeOutput(result) });
    } catch (error) {
      res.status(500).json(sanitizeError(error, 'registry-v3 capabilities'));
    }
  });

  // GET /api/dashboard/registry-v3/aliases - Alias contracts
  router.get('/registry-v3/aliases', requireDashboardAuth, async (req, res) => {
    try {
      const result = aliasContract.buildAliasContractReport({ ...services, store });
      res.json({ ok: true, status: 'success', data: sanitizeOutput(result) });
    } catch (error) {
      res.status(500).json(sanitizeError(error, 'registry-v3 aliases'));
    }
  });

  // POST /api/dashboard/registry-v3/route-plan - Generate route plan
  router.post('/registry-v3/route-plan', requireDashboardAuth, async (req, res) => {
    try {
      const result = await routePlanner.createDashboardRouteGenerationPlan({ ...services, store });
      res.json({
        ok: result.success,
        status: result.success ? 'success' : 'error',
        data: sanitizeOutput(result)
      });
    } catch (error) {
      res.status(500).json(sanitizeError(error, 'registry-v3 route plan'));
    }
  });

  // GET /api/dashboard/registry-v3/route-preview - Route preview
  router.get('/registry-v3/route-preview', requireDashboardAuth, async (req, res) => {
    try {
      const result = routePreview.buildDashboardRoutePreview({ ...services, store });
      res.json({ ok: true, status: 'success', data: sanitizeOutput(result) });
    } catch (error) {
      res.status(500).json(sanitizeError(error, 'registry-v3 route preview'));
    }
  });

  // GET /api/dashboard/registry-v3/sidebar-preview - Sidebar preview
  router.get('/registry-v3/sidebar-preview', requireDashboardAuth, async (req, res) => {
    try {
      const result = sidebarPreview.generateSidebarPreviewFromRegistryV3({ ...services, store });
      res.json({ ok: true, status: 'success', data: sanitizeOutput(result) });
    } catch (error) {
      res.status(500).json(sanitizeError(error, 'registry-v3 sidebar preview'));
    }
  });

  // GET /api/dashboard/registry-v3/mobile-preview - Mobile nav preview
  router.get('/registry-v3/mobile-preview', requireDashboardAuth, async (req, res) => {
    try {
      const result = mobileNavPreview.generateMobileNavPreviewFromRegistryV3({ ...services, store });
      res.json({ ok: true, status: 'success', data: sanitizeOutput(result) });
    } catch (error) {
      res.status(500).json(sanitizeError(error, 'registry-v3 mobile preview'));
    }
  });

  // GET /api/dashboard/registry-v3/report - Full generation report
  router.get('/registry-v3/report', requireDashboardAuth, async (req, res) => {
    try {
      const result = await genReport.buildDashboardGenerationReport({ ...services, store });
      res.json({ ok: true, status: 'success', data: sanitizeOutput(result) });
    } catch (error) {
      res.status(500).json(sanitizeError(error, 'registry-v3 report'));
    }
  });
}

module.exports = { registerRegistryV3Routes };