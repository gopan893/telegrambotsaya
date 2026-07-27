/**
 * Dashboard Generation Report Generator
 * Generates comprehensive report of all generation artifacts from registry v3
 */

const store = require('../registry-v3/registry-v3-store');
const tabContract = require('./dashboard-tab-contract-v3');
const apiContract = require('./dashboard-api-contract-v3');
const rendererContract = require('./dashboard-renderer-contract-v3');
const commandContract = require('./telegram-command-contract-v3');
const capabilityContract = require('./capability-contract-v3');
const aliasContract = require('./alias-contract-v3');
const routePlanner = require('./dashboard-route-generation-planner');
const routePreview = require('./dashboard-route-preview-builder');
const sidebarPreview = require('./dashboard-sidebar-preview-builder');
const mobilePreview = require('./dashboard-mobile-nav-preview-builder');
const contentValidator = require('./dashboard-content-contract-validator');
const commandPreview = require('./command-generation-preview-builder');
const capabilityPreview = require('./capability-generation-preview-builder');
const aliasPreview = require('./alias-generation-preview-builder');
const v3utils = require('../registry-v3/registry-v3-utils');

async function buildDashboardGenerationReport(services) {
  const frozen = store.getFrozen();

  const report = {
    generatedAt: new Date().toISOString(),
    registryStatus: store.getStatus(),
    sections: [],
    summary: {
      totalErrors: 0,
      totalWarnings: 0,
      readyForGeneration: false
    }
  };

  const addSection = (name, data) => {
    const section = { name, ...data };
    if (data.errors) report.summary.totalErrors += data.errors.length || data.errors || 0;
    if (data.warnings) report.summary.totalWarnings += data.warnings.length || data.warnings || 0;
    report.sections.push(section);
  };

  if (!frozen || !frozen.items) {
    report.summary.error = 'No frozen registry v3 available';
    report.summary.readyForGeneration = false;
    return { success: true, report: v3utils.sanitizeForDisplay(report) };
  }

  try {
    const tabReport = tabContract.buildDashboardTabContractReport(services);
    addSection('dashboard_tab_contracts', tabReport);

    const apiReport = apiContract.buildDashboardApiContractReport(services);
    addSection('dashboard_api_contracts', apiReport);

    const rendererReport = rendererContract.buildRendererContractReport(services);
    addSection('dashboard_renderer_contracts', rendererReport);

    const cmdReport = commandContract.buildTelegramCommandContractReport(services);
    addSection('telegram_command_contracts', cmdReport);

    const capReport = capabilityContract.buildCapabilityContractReport(services);
    addSection('capability_contracts', capReport);

    const aliasReport = aliasContract.buildAliasContractReport(services);
    addSection('alias_contracts', aliasReport);

    const planResult = await routePlanner.createDashboardRouteGenerationPlan(services);
    addSection('route_generation_plan', {
      success: planResult.success,
      ...planResult
    });

    const rpResult = routePreview.buildDashboardRoutePreview(services);
    addSection('route_preview', rpResult);

    const sbResult = sidebarPreview.generateSidebarPreviewFromRegistryV3(services);
    addSection('sidebar_preview', sbResult);

    const mobResult = mobilePreview.generateMobileNavPreviewFromRegistryV3(services);
    addSection('mobile_nav_preview', mobResult);

    const contentResult = contentValidator.validateDashboardContentContractsV3(services);
    addSection('content_validation', contentResult);

    const cmdPreviewResult = commandPreview.buildCommandGenerationPreview(services);
    addSection('command_generation_preview', {
      success: cmdPreviewResult.success,
      ...cmdPreviewResult
    });

    const capPreviewResult = capabilityPreview.buildCapabilityGenerationPreview(services);
    addSection('capability_generation_preview', {
      success: capPreviewResult.success,
      ...capPreviewResult
    });

    const aliasPreviewResult = aliasPreview.buildAliasGenerationPreview(services);
    addSection('alias_generation_preview', {
      success: aliasPreviewResult.success,
      ...aliasPreviewResult
    });

    report.summary.readyForGeneration = report.summary.totalErrors === 0;
  } catch (err) {
    report.summary.error = `Report generation failed: ${err.message}`;
  }

  return {
    success: true,
    report: v3utils.sanitizeForDisplay(report)
  };
}

module.exports = {
  buildDashboardGenerationReport
};