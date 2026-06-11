/**
 * Dashboard Sidebar Preview Builder
 * Builds detailed sidebar menu preview from registry v3
 */

const store = require('../registry-v3/registry-v3-store');
const utils = require('./route-generation-utils');

async function generateSidebarPreviewFromRegistryV3(services) {
  const { logger } = services;

  try {
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
      source: 'registry-v3',
      structure: 'grouped',
      groups: [],
      totalTabs: tabs.length,
      totalGroups: sortedGroups.length,
      metadata: {
        stableTabs: tabs.filter(t => t.status === 'active').length,
        publicTabs: tabs.filter(t => t.visibility === 'public').length,
        ownerOnlyTabs: tabs.filter(t => t.ownerOnly).length
      }
    };

    for (const groupName of sortedGroups) {
      const groupTabs = utils.sortTabsByPriority(grouped[groupName]);

      preview.groups.push({
        name: groupName,
        displayName: groupName,
        collapsed: false,
        tabs: groupTabs.map(tab => buildSidebarTabItem(tab))
      });
    }

    if (logger) {
      logger.info('[Sidebar Preview] Generated', {
        groups: preview.groups.length,
        tabs: preview.totalTabs
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

function buildSidebarTabItem(tab) {
  return {
    id: tab.id,
    title: utils.sanitizeTabTitle(tab.title),
    dataTab: utils.generateDataTab(tab.id),
    href: utils.generateHref(tab.id),
    icon: tab.icon || null,
    badge: tab.badge || null,
    stable: tab.status === 'active',
    requiresAuth: Boolean(tab.requiresAuth),
    ownerOnly: Boolean(tab.ownerOnly),
    priority: tab.priority || 999,
    visible: true,
    enabled: tab.enabled !== false
  };
}

async function validateSidebarPreview(preview, services) {
  const errors = [];
  const warnings = [];

  if (!preview) {
    errors.push('Preview is null or undefined');
    return { valid: false, errors, warnings };
  }

  if (!preview.groups || !Array.isArray(preview.groups)) {
    errors.push('Preview missing groups array');
    return { valid: false, errors, warnings };
  }

  const seenIds = new Set();
  const seenDataTabs = new Set();
  const seenHrefs = new Set();

  for (const group of preview.groups) {
    if (!group.name) {
      errors.push('Group missing name');
    }

    if (!group.tabs || !Array.isArray(group.tabs)) {
      errors.push(`Group ${group.name} missing tabs array`);
      continue;
    }

    for (const tab of group.tabs) {
      if (!tab.id) {
        errors.push('Tab missing id');
        continue;
      }

      if (seenIds.has(tab.id)) {
        errors.push(`Duplicate tab id in sidebar: ${tab.id}`);
      }
      seenIds.add(tab.id);

      if (!tab.dataTab) {
        errors.push(`Tab ${tab.id} missing dataTab`);
      } else if (seenDataTabs.has(tab.dataTab)) {
        errors.push(`Duplicate data-tab in sidebar: ${tab.dataTab}`);
      } else {
        seenDataTabs.add(tab.dataTab);
      }

      if (!tab.href) {
        errors.push(`Tab ${tab.id} missing href`);
      } else if (seenHrefs.has(tab.href)) {
        errors.push(`Duplicate href in sidebar: ${tab.href}`);
      } else {
        seenHrefs.add(tab.href);
      }

      if (!tab.title) {
        warnings.push(`Tab ${tab.id} missing title`);
      }

      const validation = utils.validateTabContract(tab);
      errors.push(...validation.errors.map(e => `Tab ${tab.id}: ${e}`));
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

async function detectMissingStableTabsInSidebarPreview(preview, services) {
  const frozen = store.getFrozen();

  if (!frozen || !frozen.items) {
    return {
      hasMissing: false,
      missing: []
    };
  }

  const stableTabs = frozen.items.filter(i =>
    i.type === 'dashboard_tab' &&
    i.status === 'active' &&
    i.enabled &&
    i.visibility !== 'hidden'
  );

  const previewTabIds = new Set();
  if (preview && preview.groups) {
    for (const group of preview.groups) {
      if (group.tabs) {
        for (const tab of group.tabs) {
          previewTabIds.add(tab.id);
        }
      }
    }
  }

  const missing = [];
  for (const tab of stableTabs) {
    if (!previewTabIds.has(tab.id)) {
      missing.push({
        id: tab.id,
        title: tab.title,
        group: tab.group || 'General',
        reason: 'Stable tab not included in sidebar preview'
      });
    }
  }

  return {
    hasMissing: missing.length > 0,
    missing
  };
}

async function detectDuplicateSidebarItems(preview, services) {
  const duplicates = [];
  const seenIds = new Map();

  if (!preview || !preview.groups) {
    return {
      hasDuplicates: false,
      duplicates
    };
  }

  for (const group of preview.groups) {
    if (!group.tabs) continue;

    for (const tab of group.tabs) {
      if (seenIds.has(tab.id)) {
        duplicates.push({
          id: tab.id,
          groups: [seenIds.get(tab.id), group.name],
          message: `Tab ${tab.id} appears in multiple groups`
        });
      } else {
        seenIds.set(tab.id, group.name);
      }
    }
  }

  return {
    hasDuplicates: duplicates.length > 0,
    duplicates
  };
}

function buildSidebarPreviewReport(services) {
  const previewResult = generateSidebarPreviewFromRegistryV3(services);

  if (!previewResult.success) {
    return {
      success: false,
      error: previewResult.error
    };
  }

  const preview = previewResult.preview;
  const validation = validateSidebarPreview(preview, services);
  const missingTabs = detectMissingStableTabsInSidebarPreview(preview, services);
  const duplicates = detectDuplicateSidebarItems(preview, services);

  return {
    success: true,
    preview,
    validation,
    missingTabs,
    duplicates,
    summary: {
      valid: validation.valid,
      groups: preview.groups.length,
      totalTabs: preview.totalTabs,
      errors: validation.errors.length,
      warnings: validation.warnings.length,
      missingStableTabs: missingTabs.missing?.length || 0,
      duplicates: duplicates.duplicates?.length || 0
    },
    recommendations: generateSidebarRecommendations(validation, missingTabs, duplicates)
  };
}

function generateSidebarRecommendations(validation, missingTabs, duplicates) {
  const recommendations = [];

  if (!validation.valid) {
    recommendations.push('Fix validation errors before using sidebar preview');
  }

  if (missingTabs.hasMissing) {
    recommendations.push(`${missingTabs.missing.length} stable tabs missing from sidebar - verify intentional`);
  }

  if (duplicates.hasDuplicates) {
    recommendations.push('Remove duplicate tabs from sidebar');
  }

  if (validation.valid && !missingTabs.hasMissing && !duplicates.hasDuplicates) {
    recommendations.push('Sidebar preview is ready for implementation');
  }

  return recommendations;
}

module.exports = {
  generateSidebarPreviewFromRegistryV3,
  validateSidebarPreview,
  detectMissingStableTabsInSidebarPreview,
  detectDuplicateSidebarItems,
  buildSidebarPreviewReport
};
