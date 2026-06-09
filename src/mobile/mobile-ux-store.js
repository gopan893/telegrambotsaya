'use strict';

const profiles = new Map();

function profileKey(userId, workspaceId) {
  return `${userId}::${workspaceId}`;
}

function getProfile(userId, workspaceId) {
  const key = profileKey(userId, workspaceId);
  return profiles.get(key) || null;
}

function setProfile(userId, workspaceId, data) {
  const key = profileKey(userId, workspaceId);
  const now = new Date().toISOString();
  const existing = profiles.get(key);
  const profile = {
    id: data.id || key,
    workspaceId,
    userId,
    layoutMode: data.layoutMode || 'default',
    preferredTabs: Array.isArray(data.preferredTabs) ? data.preferredTabs : [],
    quickActions: Array.isArray(data.quickActions) ? data.quickActions : [],
    compactMode: typeof data.compactMode === 'boolean' ? data.compactMode : false,
    notificationMode: data.notificationMode || 'all',
    offlineModeEnabled: typeof data.offlineModeEnabled === 'boolean' ? data.offlineModeEnabled : false,
    createdAt: existing ? existing.createdAt : now,
    updatedAt: now
  };
  profiles.set(key, profile);
  return profile;
}

function listProfiles(filter) {
  const entries = Array.from(profiles.values());
  if (!filter) return entries;
  return entries.filter(p => {
    for (const key of Object.keys(filter)) {
      if (p[key] !== filter[key]) return false;
    }
    return true;
  });
}

function removeProfile(userId, workspaceId) {
  const key = profileKey(userId, workspaceId);
  return profiles.delete(key);
}

function getStats() {
  return {
    totalProfiles: profiles.size,
    compactModeCount: Array.from(profiles.values()).filter(p => p.compactMode).length,
    offlineModeCount: Array.from(profiles.values()).filter(p => p.offlineModeEnabled).length
  };
}

function resetStore() {
  profiles.clear();
}

module.exports = {
  getProfile,
  setProfile,
  listProfiles,
  removeProfile,
  getStats,
  resetStore
};
