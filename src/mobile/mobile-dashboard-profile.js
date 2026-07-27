'use strict';

const store = require('./mobile-ux-store');
const { validateTabId } = require('./mobile-utils');

function getMobileDashboardProfile(userId, services) {
  if (!userId) return buildDefaultMobileProfile('unknown', services);
  const workspaceId = (services && services.workspaceId) || 'default';
  const existing = store.getProfile(userId, workspaceId);
  if (existing) return existing;
  return buildDefaultMobileProfile(userId, services);
}

function updateMobileDashboardProfile(profile, services) {
  const validation = validateMobileProfile(profile);
  if (!validation.valid) return { ok: false, errors: validation.errors };
  const workspaceId = (services && services.workspaceId) || 'default';
  const stored = store.setProfile(profile.userId, workspaceId, profile);
  return { ok: true, profile: stored };
}

function buildDefaultMobileProfile(userId, services) {
  const workspaceId = (services && services.workspaceId) || 'default';
  return {
    id: `${userId}::${workspaceId}`,
    workspaceId,
    userId: userId || 'unknown',
    layoutMode: 'default',
    preferredTabs: [],
    quickActions: [],
    compactMode: false,
    notificationMode: 'all',
    offlineModeEnabled: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function validateMobileProfile(profile) {
  const errors = [];
  if (!profile) {
    errors.push('Profile is required');
    return { valid: false, errors };
  }
  if (!profile.userId || typeof profile.userId !== 'string') {
    errors.push('userId is required and must be a string');
  }
  if (profile.layoutMode && !['default', 'compact'].includes(profile.layoutMode)) {
    errors.push('layoutMode must be "default" or "compact"');
  }
  if (profile.preferredTabs && !Array.isArray(profile.preferredTabs)) {
    errors.push('preferredTabs must be an array');
  }
  if (profile.preferredTabs && Array.isArray(profile.preferredTabs)) {
    profile.preferredTabs.forEach((tab, i) => {
      if (!validateTabId(tab)) {
        errors.push(`preferredTabs[${i}]: invalid tab id "${tab}"`);
      }
    });
  }
  if (profile.quickActions && !Array.isArray(profile.quickActions)) {
    errors.push('quickActions must be an array');
  }
  if (profile.notificationMode && !['all', 'important', 'none'].includes(profile.notificationMode)) {
    errors.push('notificationMode must be "all", "important", or "none"');
  }
  if (profile.layoutMode === undefined) profile.layoutMode = 'default';
  if (profile.notificationMode === undefined) profile.notificationMode = 'all';
  if (profile.compactMode === undefined) profile.compactMode = false;
  if (profile.offlineModeEnabled === undefined) profile.offlineModeEnabled = false;
  if (profile.createdAt === undefined) profile.createdAt = new Date().toISOString();
  if (profile.updatedAt === undefined) profile.updatedAt = new Date().toISOString();
  if (profile.secrets || profile.token || profile.apiKey) {
    errors.push('Profile must not contain secrets');
  }
  return { valid: errors.length === 0, errors };
}

module.exports = {
  getMobileDashboardProfile,
  updateMobileDashboardProfile,
  buildDefaultMobileProfile,
  validateMobileProfile
};
