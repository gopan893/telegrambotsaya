/**
 * Dashboard Renderer Contract v3
 * Builds and validates dashboard renderer contracts from registry v3
 */

function buildDashboardRendererContractV3(item, services) {
  if (!item) {
    return { success: false, error: 'Item is required' };
  }

  if (item.type !== 'dashboard_renderer') {
    return { success: false, error: `Item type must be dashboard_renderer, got ${item.type}` };
  }

  const contract = {
    id: item.id,
    tabId: item.tabId || null,
    rendererName: item.rendererName || item.id,
    file: item.file || `public/dashboard/${item.id}.js`,
    loadOrder: item.loadOrder || 100,
    usesApi: Boolean(item.usesApi !== false),
    apiRouteIds: Array.isArray(item.apiRouteIds) ? item.apiRouteIds : [],
    expectedTitle: item.expectedTitle || null,
    expectedContentKeywords: Array.isArray(item.expectedContentKeywords)
      ? item.expectedContentKeywords
      : [],
    supportsLoadingState: Boolean(item.supportsLoadingState !== false),
    supportsEmptyState: Boolean(item.supportsEmptyState !== false),
    supportsDegradedState: Boolean(item.supportsDegradedState !== false),
    supportsErrorState: Boolean(item.supportsErrorState !== false),
    supportsMobile: Boolean(item.supportsMobile !== false),
    supportsDarkMode: Boolean(item.supportsDarkMode !== false),
    noSecrets: Boolean(item.noSecrets !== false),
    enabled: item.enabled !== false
  };

  return { success: true, contract };
}

function validateDashboardRendererContractV3(contract, services) {
  const errors = [];
  const warnings = [];

  if (!contract) {
    errors.push('Contract is null or undefined');
    return { valid: false, errors, warnings };
  }

  if (!contract.id) {
    errors.push('Missing renderer id');
  }

  if (!contract.file) {
    errors.push('Missing renderer file path');
  }

  if (contract.usesApi && (!contract.apiRouteIds || contract.apiRouteIds.length === 0)) {
    warnings.push(`Renderer ${contract.id} uses API but has no API routes specified`);
  }

  if (!contract.supportsLoadingState) {
    warnings.push(`Renderer ${contract.id} should support loading state`);
  }

  if (!contract.supportsErrorState) {
    warnings.push(`Renderer ${contract.id} should support error state`);
  }

  if (!contract.supportsDegradedState) {
    warnings.push(`Renderer ${contract.id} should support degraded state`);
  }

  if (!contract.noSecrets) {
    errors.push(`Renderer ${contract.id} must guarantee no secrets in output`);
  }

  if (!contract.expectedTitle && !contract.expectedContentKeywords.length) {
    warnings.push(`Renderer ${contract.id} has no expected content specified`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

function normalizeRendererContractFromV2(v2Renderer, services) {
  if (!v2Renderer) {
    return { success: false, error: 'v2Renderer is required' };
  }

  const normalizedItem = {
    id: v2Renderer.id,
    type: 'dashboard_renderer',
    tabId: v2Renderer.tabId || v2Renderer.tab,
    rendererName: v2Renderer.name || v2Renderer.id,
    file: v2Renderer.file || `public/dashboard/${v2Renderer.id}.js`,
    loadOrder: v2Renderer.loadOrder || 100,
    usesApi: Boolean(v2Renderer.usesApi !== false),
    apiRouteIds: v2Renderer.apiRouteIds || [],
    expectedTitle: v2Renderer.expectedTitle || null,
    expectedContentKeywords: v2Renderer.expectedContentKeywords || [],
    supportsLoadingState: Boolean(v2Renderer.supportsLoadingState !== false),
    supportsEmptyState: Boolean(v2Renderer.supportsEmptyState !== false),
    supportsDegradedState: Boolean(v2Renderer.supportsDegradedState !== false),
    supportsErrorState: Boolean(v2Renderer.supportsErrorState !== false),
    supportsMobile: Boolean(v2Renderer.supportsMobile !== false),
    supportsDarkMode: Boolean(v2Renderer.supportsDarkMode !== false),
    noSecrets: Boolean(v2Renderer.noSecrets !== false),
    enabled: v2Renderer.enabled !== false,
    compatibility: {
      v2Source: 'dashboard-renderer-registry-v2',
      v2Id: v2Renderer.id
    }
  };

  return buildDashboardRendererContractV3(normalizedItem, services);
}

function buildRendererContractReport(renderers, services) {
  if (!Array.isArray(renderers)) {
    return {
      success: false,
      error: 'renderers must be an array'
    };
  }

  const report = {
    totalRenderers: renderers.length,
    validRenderers: 0,
    invalidRenderers: 0,
    errors: [],
    warnings: [],
    contracts: []
  };

  for (const renderer of renderers) {
    const buildResult = buildDashboardRendererContractV3(renderer, services);

    if (!buildResult.success) {
      report.invalidRenderers++;
      report.errors.push({
        rendererId: renderer.id,
        error: buildResult.error
      });
      continue;
    }

    const contract = buildResult.contract;
    const validation = validateDashboardRendererContractV3(contract, services);

    report.contracts.push({
      contract,
      validation
    });

    if (validation.valid) {
      report.validRenderers++;
    } else {
      report.invalidRenderers++;
    }

    report.errors.push(...validation.errors.map(e => ({
      rendererId: contract.id,
      error: e
    })));

    report.warnings.push(...validation.warnings.map(w => ({
      rendererId: contract.id,
      warning: w
    })));
  }

  report.success = true;
  report.allValid = report.invalidRenderers === 0 && report.errors.length === 0;

  return report;
}

function detectRendererLoadOrderRisk(renderers, services) {
  const risks = [];

  const sortedByLoadOrder = [...renderers].sort((a, b) =>
    (a.loadOrder || 100) - (b.loadOrder || 100)
  );

  for (let i = 0; i < sortedByLoadOrder.length; i++) {
    const renderer = sortedByLoadOrder[i];

    if (renderer.usesApi && i === 0) {
      risks.push({
        rendererId: renderer.id,
        type: 'api_fetch_timing',
        severity: 'high',
        message: `Renderer ${renderer.id} loads first but uses Api.fetch - may execute before Api is defined`
      });
    }
  }

  return {
    hasRisks: risks.length > 0,
    risks
  };
}

function detectApiFetchCompatibilityRisk(renderers, services) {
  const risks = [];

  for (const renderer of renderers) {
    if (!renderer.usesApi) continue;

    if (!renderer.apiRouteIds || renderer.apiRouteIds.length === 0) {
      risks.push({
        rendererId: renderer.id,
        type: 'unspecified_api_routes',
        severity: 'medium',
        message: `Renderer ${renderer.id} uses API but routes not specified`
      });
    }

    if (renderer.loadOrder && renderer.loadOrder < 10) {
      risks.push({
        rendererId: renderer.id,
        type: 'early_load_with_api',
        severity: 'high',
        message: `Renderer ${renderer.id} loads very early (${renderer.loadOrder}) but uses Api.fetch`
      });
    }
  }

  return {
    hasRisks: risks.length > 0,
    risks
  };
}

module.exports = {
  buildDashboardRendererContractV3,
  validateDashboardRendererContractV3,
  normalizeRendererContractFromV2,
  buildRendererContractReport,
  detectRendererLoadOrderRisk,
  detectApiFetchCompatibilityRisk
};
