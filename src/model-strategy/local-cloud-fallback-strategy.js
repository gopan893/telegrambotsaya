'use strict';

const utils = require('./model-strategy-utils');

function planLocalCloudFallback(task = {}, candidates = [], services = {}) {
  const localCandidates = candidates.filter(c => c.type === 'local');
  const cloudCandidates = candidates.filter(c => c.type !== 'local');
  const isPrivate = task.sensitivity === 'high' || task.class === 'private_lifeos';
  const preferLocal = isPrivate || services.preferLocal !== false;
  const localAvailable = localCandidates.length > 0;
  const cloudAvailable = cloudCandidates.length > 0;
  const plan = {
    id: utils.createId('fallback'),
    isPrivate,
    preferLocal,
    localAvailable,
    cloudAvailable,
    primaryRoute: null,
    fallbackRoutes: [],
    strategy: null
  };
  if (isPrivate) {
    if (localAvailable) {
      plan.primaryRoute = { type: 'local', provider: localCandidates[0].id, model: localCandidates[0].model };
      plan.strategy = 'private_local_only';
    } else {
      plan.primaryRoute = { type: 'local', provider: 'stub', model: 'default' };
      plan.strategy = 'private_no_local_available';
      plan.fallbackRoutes.push({ type: 'manual_review', reason: 'private_task_no_local_model' });
    }
  } else if (preferLocal && localAvailable) {
    plan.primaryRoute = { type: 'local', provider: localCandidates[0].id, model: localCandidates[0].model };
    plan.fallbackRoutes = cloudCandidates.slice(0, 2).map(c => ({ type: 'cloud', provider: c.id, model: c.model }));
    plan.strategy = 'local_preferred_cloud_fallback';
  } else if (cloudAvailable) {
    plan.primaryRoute = { type: 'cloud', provider: cloudCandidates[0].id, model: cloudCandidates[0].model };
    plan.fallbackRoutes = [];
    if (localAvailable) plan.fallbackRoutes.push({ type: 'local', provider: localCandidates[0].id, model: localCandidates[0].model });
    plan.strategy = 'cloud_primary';
  } else {
    plan.primaryRoute = { type: 'local', provider: 'stub', model: 'default' };
    plan.strategy = 'no_candidates_fallback';
  }
  return plan;
}

function evaluateFallbackNeed(result = {}, plan = {}, services = {}) {
  if (result.success) return { fallbackNeeded: false };
  if (plan.fallbackRoutes?.length) {
    return { fallbackNeeded: true, nextRoute: plan.fallbackRoutes[0], reason: 'primary_failed' };
  }
  return { fallbackNeeded: true, nextRoute: null, reason: 'no_fallback_available' };
}

function rankCandidatesByPreference(candidates = [], preferences = {}, services = {}) {
  return [...candidates].sort((a, b) => {
    if (preferences.preferLocal) {
      if (a.type === 'local' && b.type !== 'local') return -1;
      if (a.type !== 'local' && b.type === 'local') return 1;
    }
    if (preferences.maxCost && a.estimatedCost > preferences.maxCost) return 1;
    if (preferences.maxCost && b.estimatedCost > preferences.maxCost) return -1;
    return 0;
  });
}

module.exports = { planLocalCloudFallback, evaluateFallbackNeed, rankCandidatesByPreference };
