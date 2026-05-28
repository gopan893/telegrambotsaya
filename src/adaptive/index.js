'use strict';

const router = require('./adaptive-mode-router');
const profiler = require('./user-context-profiler');
const complexity = require('./intent-complexity-detector');
const style = require('./response-style-adapter');
const memorySelector = require('./adaptive-memory-selector');
const guards = require('./adaptive-guards');

function createAdaptiveSystem() {
  function route(input = {}, services = {}) {
    const user = input.user || {};
    const aiOSStatus = input.aiOSStatus || {};
    if (!guards.shouldUseAdaptive(user, input.command)) {
      return {
        enabled: false,
        applied: false,
        mode: user.mode || 'santai',
        reason: user.manualModeOverride ? 'Manual /mode override aktif.' : 'Adaptive disabled atau explicit command.',
        confidence: 1
      };
    }
    const profile = profiler.getProfile(user, aiOSStatus);
    const decision = router.routeMessage({
      text: input.text,
      profile,
      hasAttachment: input.hasAttachment
    });
    decision.memoryHints = memorySelector.selectMemoryHints(user, aiOSStatus, decision.mode);
    decision.promptHint = style.buildPromptHint(decision);
    decision.enabled = true;
    decision.applied = true;
    profiler.updateProfile(user, decision);
    if (services.persist) {
      try {
        const result = services.persist();
        if (result?.catch) result.catch(() => {});
      } catch (_) {}
    }
    return decision;
  }

  function status(user = {}, aiOSStatus = {}) {
    const profile = profiler.getProfile(user, aiOSStatus);
    return {
      enabled: profile.adaptiveEnabled,
      manualModeOverride: profile.manualModeOverride,
      currentMode: profile.currentMode,
      activeMode: user.adaptive?.activeMode || null,
      lastReason: user.adaptive?.lastReason || '-',
      lastConfidence: user.adaptive?.lastConfidence || 0,
      activeGoals: profile.activeGoals,
      activeWorkflows: profile.activeWorkflows
    };
  }

  function reset(user = {}) {
    user.adaptive = { enabled: true, activeMode: null, lastReason: '', lastConfidence: 0 };
    user.manualModeOverride = false;
    user.mode = 'auto';
    return user.adaptive;
  }

  return {
    route,
    status,
    reset,
    modules: {
      router,
      profiler,
      complexity,
      style,
      memorySelector,
      guards
    }
  };
}

module.exports = createAdaptiveSystem();
module.exports.createAdaptiveSystem = createAdaptiveSystem;
