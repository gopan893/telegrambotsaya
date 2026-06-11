/**
 * Dashboard Tab Contract v3
 * Builds and validates dashboard tab contracts from registry v3
 */

const utils = require('./route-generation-utils');

function buildDashboardTabContractV3(item, services) {
  if (!item) {
    return { success: false, error: 'Item is required' };
  }

  if (item.type !== 'dashboard_tab') {
    return { success: false, error: `Item type must be dashboard_tab, got ${item.type}` };
  }

  const contract = {
    id: item.id,
    canonicalId: item.canonicalId,
    title: utils.sanitizeTabTitle(item.title),
    description: utils.sanitizeDescription(item.description),
    group: item.group || item.category || 'General',
    dataTab: utils.generateDataTab(item.id),
    href: utils.generateHref(item.id),
    rendererId: item.rendererId || utils.generateRendererId(item.id),
    apiRouteId: item.apiRouteId || utils.generateApiRouteId(item.id),
    aliases: Array.isArray(item.aliases) ? item.aliases : [],
    stable: item.status === 'active' && item.stable !== false,
    publicVisible: utils.isPublicVisibleTab(item),
    mobileVisible: utils.isMobileVisibleTab(item),
    ownerOnly: Boolean(item.ownerOnly),
    requiresAuth: Boolean(item.requiresAuth),
    expectedContent: item.expectedContent || null,
    emptyState: item.emptyState || 'No data available',
    degradedState: item.degradedState || 'Feature not configured',
    errorState: item.errorState || 'Failed to load',
    loadingState: item.loadingState || 'Loading...',
    fallbackPolicy: item.fallbackPolicy || 'degraded',
    icon: item.icon || null,
    priority: item.priority || 999,
    docs: item.docs || null,
    tests: item.tests || null,
    enabled: item.enabled !== false
  };

  return { success: true, contract };
}

function validateDashboardTabContractV3(contract, services) {
  const errors = [];
  const warnings = [];

  if (!contract) {
    errors.push('Contract is null or undefined');
    return { valid: false, errors, warnings };
  }

  const basicValidation = utils.validateTabContract(contract);
  errors.push(...basicValidation.errors);

  if (contract.fallbackPolicy === 'overview') {
    errors.push(`Tab ${contract.id} cannot use Overview as fallback`);
  }

  if (contract.stable && !contract.expectedContent) {
    warnings.push(`Stable tab ${contract.id} should have expectedContent defined`);
  }

  if (contract.stable && !contract.rendererId) {
    errors.push(`Stable tab ${contract.id} must have rendererId`);
  }

  if (contract.stable && !contract.apiRouteId) {
    warnings.push(`Stable tab ${contract.id} should have apiRouteId`);
  }

  if (contract.publicVisible && contract.requiresAuth) {
    warnings.push(`Tab ${contract.id} marked public but requires auth`);
  }

  if (contract.ownerOnly && !contract.requiresAuth) {
    warnings.push(`Owner-only tab ${contract.id} should require auth`);
  }

  if (contract.stable && !contract.docs) {
    warnings.push(`Stable tab ${contract.id} should have documentation`);
  }

  if (contract.stable && !contract.tests) {
    warnings.push(`Stable tab ${contract.id} should have tests`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

function normalizeDashboardTabContractFromV2(v2Tab, services) {
  if (!v2Tab) {
    return { success: false, error: 'v2Tab is required' };
  }

  const normalizedItem = {
    id: v2Tab.id || v2Tab.dataTab,
    type: 'dashboard_tab',
    title: v2Tab.title || v2Tab.label,
    description: v2Tab.description || null,
    group: v2Tab.group || v2Tab.category || 'General',
    canonicalId: `dashboard_tab:${v2Tab.id || v2Tab.dataTab}`,
    aliases: v2Tab.aliases || [],
    status: v2Tab.enabled === false ? 'deprecated' : 'active',
    visibility: v2Tab.publicVisible ? 'public' : 'internal',
    riskLevel: 'low',
    requiresAuth: Boolean(v2Tab.requiresAuth),
    requiresOwner: Boolean(v2Tab.ownerOnly),
    ownerOnly: Boolean(v2Tab.ownerOnly),
    stable: v2Tab.stable !== false,
    rendererId: v2Tab.rendererId || v2Tab.renderer,
    apiRouteId: v2Tab.apiRouteId || v2Tab.apiRoute,
    expectedContent: v2Tab.expectedContent || null,
    emptyState: v2Tab.emptyState || 'No data available',
    degradedState: v2Tab.degradedState || 'Feature not configured',
    errorState: v2Tab.errorState || 'Failed to load',
    loadingState: v2Tab.loadingState || 'Loading...',
    fallbackPolicy: v2Tab.fallbackPolicy || 'degraded',
    mobileVisible: Boolean(v2Tab.mobileVisible),
    icon: v2Tab.icon || null,
    priority: v2Tab.priority || 999,
    docs: v2Tab.docs || null,
    tests: v2Tab.tests || null,
    enabled: v2Tab.enabled !== false,
    compatibility: {
      v2Source: 'dashboard-tab-registry-v2',
      v2Id: v2Tab.id
    }
  };

  return buildDashboardTabContractV3(normalizedItem, services);
}

function buildDashboardTabContractReport(tabs, services) {
  if (!Array.isArray(tabs)) {
    return {
      success: false,
      error: 'tabs must be an array'
    };
  }

  const report = {
    totalTabs: tabs.length,
    validTabs: 0,
    invalidTabs: 0,
    stableTabs: 0,
    unstableTabs: 0,
    publicTabs: 0,
    mobileTabs: 0,
    errors: [],
    warnings: [],
    contracts: []
  };

  for (const tab of tabs) {
    const buildResult = buildDashboardTabContractV3(tab, services);

    if (!buildResult.success) {
      report.invalidTabs++;
      report.errors.push({
        tabId: tab.id,
        error: buildResult.error
      });
      continue;
    }

    const contract = buildResult.contract;
    const validation = validateDashboardTabContractV3(contract, services);

    report.contracts.push({
      contract,
      validation
    });

    if (validation.valid) {
      report.validTabs++;
    } else {
      report.invalidTabs++;
    }

    if (contract.stable) {
      report.stableTabs++;
    } else {
      report.unstableTabs++;
    }

    if (contract.publicVisible) {
      report.publicTabs++;
    }

    if (contract.mobileVisible) {
      report.mobileTabs++;
    }

    report.errors.push(...validation.errors.map(e => ({
      tabId: contract.id,
      error: e
    })));

    report.warnings.push(...validation.warnings.map(w => ({
      tabId: contract.id,
      warning: w
    })));
  }

  report.success = true;
  report.allValid = report.invalidTabs === 0 && report.errors.length === 0;

  return report;
}

function detectTabContractGaps(tabs, services) {
  const gaps = [];

  const stableTabs = tabs.filter(t => t.stable === true || t.status === 'active');

  for (const tab of stableTabs) {
    if (!tab.rendererId) {
      gaps.push({
        tabId: tab.id,
        type: 'missing_renderer',
        severity: 'high',
        message: `Stable tab ${tab.id} missing renderer`
      });
    }

    if (!tab.apiRouteId) {
      gaps.push({
        tabId: tab.id,
        type: 'missing_api',
        severity: 'medium',
        message: `Stable tab ${tab.id} missing API route`
      });
    }

    if (!tab.expectedContent) {
      gaps.push({
        tabId: tab.id,
        type: 'missing_expected_content',
        severity: 'medium',
        message: `Stable tab ${tab.id} missing expected content specification`
      });
    }

    if (!tab.docs) {
      gaps.push({
        tabId: tab.id,
        type: 'missing_docs',
        severity: 'low',
        message: `Stable tab ${tab.id} missing documentation`
      });
    }

    if (!tab.tests) {
      gaps.push({
        tabId: tab.id,
        type: 'missing_tests',
        severity: 'medium',
        message: `Stable tab ${tab.id} missing tests`
      });
    }
  }

  return {
    hasGaps: gaps.length > 0,
    gaps,
    summary: {
      total: gaps.length,
      high: gaps.filter(g => g.severity === 'high').length,
      medium: gaps.filter(g => g.severity === 'medium').length,
      low: gaps.filter(g => g.severity === 'low').length
    }
  };
}

module.exports = {
  buildDashboardTabContractV3,
  validateDashboardTabContractV3,
  normalizeDashboardTabContractFromV2,
  buildDashboardTabContractReport,
  detectTabContractGaps
};
