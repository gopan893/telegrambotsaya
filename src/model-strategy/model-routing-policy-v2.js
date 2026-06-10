'use strict';

const store = require('./model-strategy-store');
const utils = require('./model-strategy-utils');
const privacyGuard = require('./model-privacy-guard');
const strategyEngine = require('./task-model-strategy-engine');

function buildRoutingDecision(task = {}, strategy = {}, candidates = [], services = {}) {
  const selected = selectBestCandidate(candidates, strategy, task, services);
  const blocked = privacyGuard.blockUnsafeRoute(selected, task, services);
  if (blocked.blocked) {
    const fallback = findFallbackRoute(candidates, strategy, task, services);
    return {
      id: utils.createId('rtv2'),
      taskType: task.class || task.taskType || 'unknown',
      sensitivity: task.sensitivity || 'low',
      provider: fallback?.provider || 'local',
      model: fallback?.model || 'default',
      strategy: strategy.strategy || 'fallback',
      reason: `blocked_${blocked.reason}_fallback_used`,
      blocked: true,
      originalBlocked: blocked,
      fallbackPlan: fallback,
      routedAt: new Date().toISOString()
    };
  }
  return {
    id: utils.createId('rtv2'),
    taskType: task.class || task.taskType || 'unknown',
    sensitivity: task.sensitivity || 'low',
    provider: selected?.provider || 'local',
    model: selected?.model || 'default',
    strategy: strategy.strategy || 'quality',
    reason: strategy.reason || 'default',
    blocked: false,
    fallbackPlan: buildFallbackPlan(candidates, strategy, task, services),
    routedAt: new Date().toISOString()
  };
}

function selectBestCandidate(candidates = [], strategy = {}, task = {}, services = {}) {
  if (!candidates.length) return null;
  if (strategy.localOnly) return candidates.find(c => c.type === 'local') || candidates[0];
  const scored = candidates.map(c => ({
    ...c,
    score: scoreCandidate(c, strategy, task)
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored[0];
}

function scoreCandidate(candidate = {}, strategy = {}, task = {}) {
  const weights = strategy.costWeight != null ? strategy : { costWeight: 0.3, qualityWeight: 0.5, latencyWeight: 0.2 };
  const costScore = candidate.costTier === 'low' ? 1 : candidate.costTier === 'medium' ? 0.6 : 0.3;
  const qualityScore = candidate.qualityTier === 'high' ? 1 : candidate.qualityTier === 'medium' ? 0.6 : 0.3;
  const latencyScore = candidate.latencyTier === 'low' ? 1 : candidate.latencyTier === 'medium' ? 0.6 : 0.3;
  return costScore * (weights.costWeight || 0.3) + qualityScore * (weights.qualityWeight || 0.5) + latencyScore * (weights.latencyWeight || 0.2);
}

function findFallbackRoute(candidates = [], strategy = {}, task = {}, services = {}) {
  const local = candidates.find(c => c.type === 'local');
  if (local) return { provider: local.id, model: local.model || 'default', type: 'local' };
  if (candidates.length) return { provider: candidates[0].id, model: candidates[0].model || 'default', type: candidates[0].type };
  return { provider: 'local', model: 'default', type: 'local' };
}

function buildFallbackPlan(candidates = [], strategy = {}, task = {}, services = {}) {
  const primary = selectBestCandidate(candidates, strategy, task, services);
  const local = candidates.find(c => c.type === 'local');
  const cheap = candidates.filter(c => c.costTier === 'low' && c !== primary)[0];
  return {
    primary: primary ? { provider: primary.id, model: primary.model } : null,
    localFallback: local ? { provider: local.id, model: local.model } : null,
    cheapFallback: cheap ? { provider: cheap.id, model: cheap.model } : null
  };
}

async function recordRoutingDecision(decision, services = {}) {
  return store.addRecord('routingDecisions', decision, services);
}

async function getRecentDecisions(limit = 50, services = {}) {
  return (await store.getRecords('routingDecisions', null, services)).slice(-limit);
}

module.exports = { buildRoutingDecision, selectBestCandidate, findFallbackRoute, buildFallbackPlan, recordRoutingDecision, getRecentDecisions };
