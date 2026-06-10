'use strict';

const { createUnifiedItem } = require('./unified-registry-contract');
const { STABLE_TABS } = require('./dashboard-tab-registry-v2');

const DEFAULT_APIS = STABLE_TABS.map(tab => ({
  id: `${tab.id}-api`,
  method: 'GET',
  path: tab.apiEndpoint,
  tabId: tab.id,
  protected: true,
  contract: { responseType: 'json', cacheable: true },
  riskLevel: 'low',
  directDangerousAction: false,
  fallbackStatus: 503,
  enabled: true
}));

function buildDashboardApiRegistryV2(services) {
  return DEFAULT_APIS.map(api => createUnifiedItem({
    ...api,
    type: 'dashboard_api',
    module: 'dashboard-api-registry-v2',
    ownerModule: 'registry-v2'
  }));
}

function normalizeDashboardApisFromLegacy(services) {
  if (services && services.legacyApiRegistry) {
    const legacy = services.legacyApiRegistry;
    return DEFAULT_APIS.map(api => {
      const legacyApi = legacy.find(l => l.id === api.id || (l.tabId === api.tabId && l.path === api.path));
      return legacyApi ? { ...api, ...legacyApi } : api;
    });
  }
  return [...DEFAULT_APIS];
}

function validateDashboardApiRegistryV2(registry, services) {
  const errors = [];
  if (!Array.isArray(registry)) return ['registry must be an array'];
  const ids = new Set();
  for (const api of registry) {
    if (!api.id) errors.push('api missing id');
    if (!api.path) errors.push(`api ${api.id || 'unknown'} missing path`);
    if (!api.tabId) errors.push(`api ${api.id} missing tabId`);
    if (api.protected === undefined) errors.push(`api ${api.id} must specify protected`);
    if (ids.has(api.id)) errors.push(`duplicate api id: ${api.id}`);
    ids.add(api.id);
  }
  return errors;
}

function generateSafePlaceholderApiForMissing(tab, services) {
  return {
    id: `${tab.id}-placeholder-api`,
    method: 'GET',
    path: `/api/v2/${tab.id}`,
    tabId: tab.id,
    protected: true,
    contract: { responseType: 'json', cacheable: false, placeholder: true },
    riskLevel: 'low',
    directDangerousAction: false,
    fallbackStatus: 501,
    enabled: false
  };
}

function certifyDashboardApiFromRegistry(registry, services) {
  if (!Array.isArray(registry)) return { certified: false, errors: ['registry must be an array'] };
  const errors = validateDashboardApiRegistryV2(registry, services);
  if (errors.length > 0) return { certified: false, errors };
  const unprotected = registry.filter(api => api.protected === false || api.protected === undefined);
  if (unprotected.length > 0) {
    return { certified: false, errors: [`unprotected apis: ${unprotected.map(a => a.id).join(', ')}`] };
  }
  return { certified: true, errors: [] };
}

module.exports = {
  DEFAULT_APIS,
  buildDashboardApiRegistryV2,
  normalizeDashboardApisFromLegacy,
  validateDashboardApiRegistryV2,
  generateSafePlaceholderApiForMissing,
  certifyDashboardApiFromRegistry
};
