/**
 * Dashboard Mobile Nav Preview Builder
 * Builds mobile navigation preview from registry v3
 */

const store = require('../registry-v3/registry-v3-store');
const utils = require('./route-generation-utils');

async function generateMobileNavPreviewFromRegistryV3(services) {
  const { logger } = services;

  try {
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

    const sortedTabs = utils.sortTabsByPriority(mobileTabs);
    const bottomNavTabs = sortedTabs.slice(0, 5);
    const menuTabs = sortedTabs.slice(5);

    const preview = {
      generatedAt: new Date().toISOString(),
      source: 'registry-v3',
      bottomNav: bottomNavTabs.map(tab => buildMobileNavItem(tab)),
      menu: menuTabs.map(tab => buildMobileMenuItem(tab)),
      totalMobileTabs: mobileTabs.length,
      bottomNavCount: bottomNavTabs.length,
      menuCount: menuTabs.length,
      metadata: {
        stableTabs: mobileTabs.filter(t => t.status === 'active').length,
        ownerOnlyTabs: mobileTabs.filter(t => t.ownerOnly).length
      }
    };

    if (logger) {
      logger.info('[Mobile Nav Preview] Generated', {
        totalTabs: preview.totalMobileTabs,
        bottomNav: preview.bottomNavCount,
        menu: preview.menuCount
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

function buildMobileNavItem(tab) {
  return {
    id: tab.id,
    title: utils.sanitizeTabTitle(tab.title),
    shortTitle: tab.shortTitle || tab.title?.substring(0, 10) || tab.id,
    dataTab: utils.generateDataTab(tab.id),
    href: utils.generateHref(tab.id),
    icon: tab.icon || '📱',
    badge: tab.badge || null,
    requiresAuth: Boolean(tab.requiresAuth),
    ownerOnly: Boolean(tab.ownerOnly),
    priority: tab.priority || 999
  };
}

function buildMobileMenuItem(tab) {
  return {
    id: tab.id,
    title: utils.sanitizeTabTitle(tab.title),
    dataTab: utils.generateDataTab(tab.id),
    href: utils.generateHref(tab.id),
    icon: tab.icon || null,
    group: tab.group || 'General',
    requiresAuth: Boolean(tab.requiresAuth),
    ownerOnly: Boolean(tab.ownerOnly)
  };
}

async function validateMobileNavPreview(preview, services) {
  const errors = [];
  const warnings = [];

  if (!preview) {
    errors.push('Preview is null or undefined');
    return { valid: false, errors, warnings };
  }

  if (!preview.bottomNav || !Array.isArray(preview.bottomNav)) {
    errors.push('Preview missing bottomNav array');
  }

  if (!preview.menu || !Array.isArray(preview.menu)) {
    errors.push('Preview missing menu array');
  }

  if (preview.bottomNav && preview.bottomNav.length > 5) {
    warnings.push(`Bottom nav has ${preview.bottomNav.length} items - recommend max 5 for mobile`);
  }

  if (preview.bottomNav && preview.bottomNav.length === 0) {
    warnings.push('Bottom nav is empty - users need quick access to key features');
  }

  const seenIds = new Set();

  if (preview.bottomNav) {
    for (const item of preview.bottomNav) {
      if (!item.id) {
        errors.push('Bottom nav item missing id');
      } else if (seenIds.has(item.id)) {
        errors.push(`Duplicate item in mobile nav: ${item.id}`);
      } else {
        seenIds.add(item.id);
      }

      if (!item.dataTab || !item.href) {
        errors.push(`Mobile nav item ${item.id} missing dataTab or href`);
      }

      if (!item.icon) {
        warnings.push(`Mobile nav item ${item.id} missing icon`);
      }
    }
  }

  if (preview.menu) {
    for (const item of preview.menu) {
      if (!item.id) {
        errors.push('Menu item missing id');
      } else if (seenIds.has(item.id)) {
        errors.push(`Duplicate item in mobile nav: ${item.id}`);
      } else {
        seenIds.add(item.id);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

async function detectMobileNavCoverageGaps(preview, services) {
  const gaps = [];

  const frozen = store.getFrozen();
  if (!frozen || !frozen.items) {
    return { hasGaps: false, gaps };
  }

  const importantTabs = frozen.items.filter(i =>
    i.type === 'dashboard_tab' &&
    i.enabled &&
    (i.group === 'Control Panel' || i.priority < 50)
  );

  if (!preview || !preview.bottomNav) {
    return { hasGaps: false, gaps };
  }

  const bottomNavIds = new Set(preview.bottomNav.map(n => n.id));

  for (const tab of importantTabs) {
    if (!tab.mobileVisible) {
      gaps.push({
        tabId: tab.id,
        title: tab.title,
        type: 'important_tab_not_mobile_visible',
        severity: 'medium',
        message: `Important tab ${tab.id} not marked mobileVisible`
      });
    }

    if (tab.mobileVisible && !bottomNavIds.has(tab.id)) {
      if (tab.priority < 10) {
        gaps.push({
          tabId: tab.id,
          title: tab.title,
          type: 'high_priority_not_in_bottom_nav',
          severity: 'low',
          message: `High priority tab ${tab.id} not in bottom nav`
        });
      }
    }
  }

  return {
    hasGaps: gaps.length > 0,
    gaps
  };
}

function buildMobileNavPreviewReport(services) {
  const previewResult = generateMobileNavPreviewFromRegistryV3(services);

  if (!previewResult.success) {
    return {
      success: false,
      error: previewResult.error
    };
  }

  const preview = previewResult.preview;
  const validation = validateMobileNavPreview(preview, services);
  const coverageGaps = detectMobileNavCoverageGaps(preview, services);

  return {
    success: true,
    preview,
    validation,
    coverageGaps,
    summary: {
      valid: validation.valid,
      totalMobileTabs: preview.totalMobileTabs,
      bottomNavCount: preview.bottomNavCount,
      menuCount: preview.menuCount,
      errors: validation.errors.length,
      warnings: validation.warnings.length,
      coverageGaps: coverageGaps.gaps?.length || 0
    },
    recommendations: generateMobileNavRecommendations(validation, coverageGaps)
  };
}

function generateMobileNavRecommendations(validation, coverageGaps) {
  const recommendations = [];

  if (!validation.valid) {
    recommendations.push('Fix validation errors before using mobile nav preview');
  }

  if (validation.warnings.some(w => w.includes('Bottom nav is empty'))) {
    recommendations.push('Add important tabs to bottom nav for quick mobile access');
  }

  if (validation.warnings.some(w => w.includes('max 5'))) {
    recommendations.push('Reduce bottom nav items to 5 or fewer for better mobile UX');
  }

  if (coverageGaps.hasGaps) {
    const importantGaps = coverageGaps.gaps.filter(g => g.severity === 'medium');
    if (importantGaps.length > 0) {
      recommendations.push(`${importantGaps.length} important tabs not mobile-accessible`);
    }
  }

  if (validation.valid && !coverageGaps.hasGaps) {
    recommendations.push('Mobile nav preview is ready for implementation');
  }

  return recommendations;
}

module.exports = {
  generateMobileNavPreviewFromRegistryV3,
  validateMobileNavPreview,
  detectMobileNavCoverageGaps,
  buildMobileNavPreviewReport
};
