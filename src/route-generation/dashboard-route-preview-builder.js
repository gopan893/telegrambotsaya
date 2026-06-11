/**
 * Dashboard Route Preview Builder
 * Builds preview artifacts showing generated route structure
 */

const store = require('../registry-v3/registry-v3-store');
const utils = require('./route-generation-utils');

async function buildDashboardRoutePreview(services) {
  const { logger } = services;

  try {
    const frozen = store.getFrozen();

    if (!frozen || !frozen.items) {
      return {
        success: false,
        error: 'No frozen registry v3 available'
      };
    }

    const tabs = frozen.items.filter(i => i.type === 'dashboard_tab' && i.enabled);
    const apis = frozen.items.filter(i => i.type === 'dashboard_api' && i.enabled);

    const preview = {
      generatedAt: new Date().toISOString(),
      source: 'registry-v3',
      tabs: buildTabsPreview(tabs),
      apis: buildApisPreview(apis),
      summary: {
        totalTabs: tabs.length,
        stableTabs: tabs.filter(t => t.status === 'active').length,
        totalApis: apis.length,
        protectedApis: apis.filter(a => a.requiresAuth).length
      },
      warnings: [],
      conflicts: []
    };

    const conflicts = detectRouteConflicts(preview);
    preview.conflicts.push(...conflicts);

    const warnings = detectRouteWarnings(preview);
    preview.warnings.push(...warnings);

    if (logger) {
      logger.info('[Route Preview] Generated', {
        tabs: preview.tabs.length,
        apis: preview.apis.length,
        warnings: preview.warnings.length,
        conflicts: preview.conflicts.length
      });
    }

    return {
      success: true,
      preview
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

function buildTabsPreview(tabs) {
  const preview = [];

  for (const tab of tabs) {
    preview.push({
      id: tab.id,
      title: tab.title,
      dataTab: utils.generateDataTab(tab.id),
      href: utils.generateHref(tab.id),
      group: tab.group || 'General',
      stable: tab.status === 'active',
      requiresAuth: Boolean(tab.requiresAuth),
      ownerOnly: Boolean(tab.ownerOnly),
      mobileVisible: Boolean(tab.mobileVisible),
      enabled: tab.enabled !== false,
      rendererId: tab.rendererId || utils.generateRendererId(tab.id),
      apiRouteId: tab.apiRouteId || utils.generateApiRouteId(tab.id)
    });
  }

  return preview;
}

function buildApisPreview(apis) {
  const preview = [];

  for (const api of apis) {
    preview.push({
      id: api.id,
      method: api.method || 'GET',
      path: api.path || utils.generateApiPath(api.id),
      requiresAuth: Boolean(api.requiresAuth),
      requiresOwner: Boolean(api.requiresOwner),
      requiresAdmin: Boolean(api.requiresAdmin),
      riskLevel: api.riskLevel || 'low',
      actionType: api.actionType || 'read',
      enabled: api.enabled !== false
    });
  }

  return preview;
}

function detectRouteConflicts(preview) {
  const conflicts = [];

  const seenDataTabs = new Set();
  const seenHrefs = new Set();
  const seenApiPaths = new Map();

  for (const tab of preview.tabs) {
    if (seenDataTabs.has(tab.dataTab)) {
      conflicts.push({
        type: 'duplicate_data_tab',
        severity: 'high',
        message: `Duplicate data-tab: ${tab.dataTab}`,
        items: [tab.id]
      });
    }
    seenDataTabs.add(tab.dataTab);

    if (seenHrefs.has(tab.href)) {
      conflicts.push({
        type: 'duplicate_href',
        severity: 'high',
        message: `Duplicate href: ${tab.href}`,
        items: [tab.id]
      });
    }
    seenHrefs.add(tab.href);
  }

  for (const api of preview.apis) {
    const pathKey = `${api.method}:${api.path}`;
    if (seenApiPaths.has(pathKey)) {
      conflicts.push({
        type: 'duplicate_api_path',
        severity: 'high',
        message: `Duplicate API path: ${api.method} ${api.path}`,
        items: [seenApiPaths.get(pathKey), api.id]
      });
    }
    seenApiPaths.set(pathKey, api.id);
  }

  return conflicts;
}

function detectRouteWarnings(preview) {
  const warnings = [];

  for (const tab of preview.tabs) {
    if (tab.stable && !tab.rendererId) {
      warnings.push({
        type: 'missing_renderer',
        severity: 'medium',
        message: `Stable tab ${tab.id} missing renderer`,
        item: tab.id
      });
    }

    if (tab.stable && !tab.apiRouteId) {
      warnings.push({
        type: 'missing_api',
        severity: 'low',
        message: `Stable tab ${tab.id} missing API route`,
        item: tab.id
      });
    }
  }

  return warnings;
}

async function buildSidebarPreview(services) {
  const frozen = store.getFrozen();

  if (!frozen || !frozen.items) {
    return {
      success: false,
      error: 'No frozen registry v3 available'
    };
  }

  const tabs = frozen.items.filter(i =>
    i.type === 'dashboard_tab' &&
    i.enabled &&
    i.visibility !== 'hidden'
  );

  const grouped = utils.groupTabsByCategory(tabs);
  const sortedGroups = Object.keys(grouped).sort();

  const preview = {
    generatedAt: new Date().toISOString(),
    groups: [],
    totalTabs: tabs.length,
    totalGroups: sortedGroups.length
  };

  for (const groupName of sortedGroups) {
    const groupTabs = utils.sortTabsByPriority(grouped[groupName]);

    preview.groups.push({
      name: groupName,
      tabs: groupTabs.map(tab => ({
        id: tab.id,
        title: tab.title,
        dataTab: utils.generateDataTab(tab.id),
        href: utils.generateHref(tab.id),
        icon: tab.icon || null,
        requiresAuth: Boolean(tab.requiresAuth),
        ownerOnly: Boolean(tab.ownerOnly)
      }))
    });
  }

  return {
    success: true,
    preview
  };
}

async function buildMobileNavPreview(services) {
  const frozen = store.getFrozen();

  if (!frozen || !frozen.items) {
    return {
      success: false,
      error: 'No frozen registry v3 available'
    };
  }

  const mobileTabs = frozen.items.filter(i =>
    i.type === 'dashboard_tab' &&
    i.enabled &&
    i.mobileVisible === true
  );

  const importantTabs = utils.sortTabsByPriority(mobileTabs).slice(0, 5);
  const otherTabs = utils.sortTabsByPriority(mobileTabs).slice(5);

  const preview = {
    generatedAt: new Date().toISOString(),
    bottomNav: importantTabs.map(tab => ({
      id: tab.id,
      title: tab.title,
      dataTab: utils.generateDataTab(tab.id),
      href: utils.generateHref(tab.id),
      icon: tab.icon || '📱'
    })),
    menuItems: otherTabs.map(tab => ({
      id: tab.id,
      title: tab.title,
      dataTab: utils.generateDataTab(tab.id),
      href: utils.generateHref(tab.id)
    })),
    totalMobileTabs: mobileTabs.length,
    bottomNavCount: importantTabs.length,
    menuItemsCount: otherTabs.length
  };

  return {
    success: true,
    preview
  };
}

async function buildApiRoutePreview(services) {
  const frozen = store.getFrozen();

  if (!frozen || !frozen.items) {
    return {
      success: false,
      error: 'No frozen registry v3 available'
    };
  }

  const apis = frozen.items.filter(i => i.type === 'dashboard_api' && i.enabled);

  const preview = {
    generatedAt: new Date().toISOString(),
    routes: apis.map(api => ({
      id: api.id,
      method: api.method || 'GET',
      path: api.path || utils.generateApiPath(api.id),
      module: api.module || null,
      requiresAuth: Boolean(api.requiresAuth),
      requiresOwner: Boolean(api.requiresOwner),
      riskLevel: api.riskLevel || 'low',
      actionType: api.actionType || 'read'
    })),
    totalRoutes: apis.length,
    summary: {
      protectedRoutes: apis.filter(a => a.requiresAuth).length,
      dangerousRoutes: apis.filter(a => a.actionType === 'dangerous').length,
      readOnlyRoutes: apis.filter(a => a.actionType === 'read').length
    }
  };

  return {
    success: true,
    preview
  };
}

function validatePreviewStructure(preview) {
  const errors = [];

  if (!preview) {
    errors.push('Preview is null or undefined');
    return { valid: false, errors };
  }

  if (!preview.tabs || !Array.isArray(preview.tabs)) {
    errors.push('Preview missing tabs array');
  }

  if (!preview.apis || !Array.isArray(preview.apis)) {
    errors.push('Preview missing apis array');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

module.exports = {
  buildDashboardRoutePreview,
  buildSidebarPreview,
  buildMobileNavPreview,
  buildApiRoutePreview,
  validatePreviewStructure
};
