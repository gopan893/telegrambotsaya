/**
 * Route Generation Utilities
 * Shared utilities for route generation
 */

function normalizeTabId(id) {
  if (!id) return null;
  return String(id).toLowerCase().trim().replace(/[^a-z0-9_-]/g, '-');
}

function generateDataTab(id) {
  return normalizeTabId(id);
}

function generateHref(id) {
  const normalized = normalizeTabId(id);
  return normalized ? `#${normalized}` : null;
}

function generateRendererId(tabId) {
  return `${normalizeTabId(tabId)}-renderer`;
}

function generateApiRouteId(tabId) {
  return `${normalizeTabId(tabId)}-api`;
}

function generateApiPath(tabId) {
  const normalized = normalizeTabId(tabId);
  return normalized ? `/api/dashboard/${normalized}` : null;
}

function isStableTab(tab) {
  return tab && tab.status === 'active' && tab.stable !== false;
}

function isPublicVisibleTab(tab) {
  return tab && (tab.visibility === 'public' || tab.publicVisible === true);
}

function isMobileVisibleTab(tab) {
  return tab && tab.mobileVisible === true;
}

function groupTabsByCategory(tabs) {
  const grouped = {};

  for (const tab of tabs) {
    const category = tab.group || tab.category || 'General';
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(tab);
  }

  return grouped;
}

function sortTabsByPriority(tabs) {
  return [...tabs].sort((a, b) => {
    const priorityA = a.priority || 999;
    const priorityB = b.priority || 999;
    return priorityA - priorityB;
  });
}

function sanitizeTabTitle(title) {
  if (!title) return 'Untitled';
  return String(title).trim().substring(0, 50);
}

function sanitizeDescription(description) {
  if (!description) return null;
  return String(description).trim().substring(0, 200);
}

function validateTabContract(tab) {
  const errors = [];

  if (!tab.id) {
    errors.push('Missing tab id');
  }

  if (!tab.title) {
    errors.push('Missing tab title');
  }

  if (!tab.dataTab) {
    errors.push('Missing data-tab attribute');
  }

  if (!tab.href) {
    errors.push('Missing href attribute');
  }

  if (tab.dataTab && tab.id && tab.dataTab !== tab.id) {
    errors.push('data-tab must match id');
  }

  if (tab.href && tab.id && tab.href !== `#${tab.id}`) {
    errors.push('href must be #<id>');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

function buildTabNavItem(tab) {
  return {
    id: tab.id,
    title: tab.title,
    dataTab: tab.dataTab || tab.id,
    href: tab.href || `#${tab.id}`,
    icon: tab.icon || null,
    enabled: tab.enabled !== false,
    visible: tab.visibility !== 'hidden'
  };
}

module.exports = {
  normalizeTabId,
  generateDataTab,
  generateHref,
  generateRendererId,
  generateApiRouteId,
  generateApiPath,
  isStableTab,
  isPublicVisibleTab,
  isMobileVisibleTab,
  groupTabsByCategory,
  sortTabsByPriority,
  sanitizeTabTitle,
  sanitizeDescription,
  validateTabContract,
  buildTabNavItem
};
