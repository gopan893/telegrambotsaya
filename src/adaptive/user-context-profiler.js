'use strict';

function getProfile(user = {}, aiOSStatus = {}) {
  const adaptive = user.adaptive || {};
  const preferences = user.preferences || {};
  return {
    adaptiveEnabled: adaptive.enabled !== false,
    manualModeOverride: Boolean(user.manualModeOverride),
    currentMode: user.mode || 'auto',
    lastAdaptiveMode: adaptive.activeMode || null,
    activeGoals: Number(aiOSStatus.activeGoals || 0),
    activeWorkflows: Number(aiOSStatus.activeWorkflows || 0),
    tags: Array.isArray(user.tags) ? user.tags.slice(-10) : [],
    prefersLearning: /belajar|mentor|step/i.test(JSON.stringify(preferences)),
    projectContextAvailable: Boolean(user.summary || aiOSStatus.graphNodes > 0)
  };
}

function updateProfile(user = {}, decision = {}) {
  if (!user.adaptive) user.adaptive = { enabled: true };
  user.adaptive.activeMode = decision.mode || user.adaptive.activeMode || 'auto';
  user.adaptive.lastReason = decision.reason || '';
  user.adaptive.lastConfidence = Number(decision.confidence || 0);
  user.adaptive.updatedAt = new Date().toISOString();
  return user.adaptive;
}

module.exports = {
  getProfile,
  updateProfile
};
