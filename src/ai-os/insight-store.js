'use strict';

const legacyGuards = require('./guards');
const guards = require('./aios-guards');
const utils = require('./aios-utils');

const STORAGE_KEY = 'aios_insights';

function normalizeInsight(userId, data = {}) {
  const now = utils.nowIso();
  const content = guards.sanitizeUserText(data.content || data.text || '', 900);
  return {
    id: data.id || utils.createId('insight'),
    userId: utils.normalizeUserId(userId),
    type: guards.sanitizeUserText(data.type || 'insight', 60) || 'insight',
    content,
    text: content,
    source: guards.sanitizeUserText(data.source || 'user', 80),
    relatedConcepts: guards.safeJsonArray(data.relatedConcepts || data.tags)
      .map(item => guards.sanitizeUserText(item, 80).toLowerCase())
      .filter(Boolean)
      .slice(0, 12),
    confidence: utils.clamp(data.confidence, 0, 1, 0.7),
    importance: utils.clamp(data.importance, 0, 1, 0.65),
    createdAt: data.createdAt || now,
    updatedAt: data.updatedAt || now
  };
}

async function createInsight(userId, data = {}, services = {}) {
  const size = guards.preventHugeInput(data.content || data.text || '', 900);
  if (!size.ok) return { ok: false, reason: size.reason };

  const insight = normalizeInsight(userId, data);
  if (!insight.content) return { ok: false, reason: 'INSIGHT_CONTENT_REQUIRED' };

  const state = legacyGuards.ensureAIOSState(userId, services);
  const exists = state.insights.some(item => {
    const prev = utils.compactText(item.content || item.text || '', 180).toLowerCase();
    const next = utils.compactText(insight.content, 180).toLowerCase();
    return prev === next;
  });

  if (!exists) state.insights.push(insight);
  state.insights = guards.enforceInsightLimit(state.insights);
  legacyGuards.touchState(state);
  legacyGuards.persistAsync(services);
  await mirrorInsightsToStorage(userId, state, services);
  return { ok: true, insight, deduped: exists };
}

async function listInsights(userId, options = {}, services = {}) {
  const state = await hydrateInsightsFromStorage(userId, services);
  const limit = Math.max(1, Math.min(Number(options.limit || 10), 50));
  return guards.safeJsonArray(state.insights)
    .sort((a, b) => Date.parse(b.updatedAt || b.createdAt || 0) - Date.parse(a.updatedAt || a.createdAt || 0))
    .slice(0, limit);
}

async function searchInsights(userId, query = '', options = {}, services = {}) {
  const state = await hydrateInsightsFromStorage(userId, services);
  const limit = Math.max(1, Math.min(Number(options.limit || 5), 20));
  const q = guards.sanitizeUserText(query, 500);
  return guards.safeJsonArray(state.insights)
    .map(insight => ({
      insight,
      score: utils.textScore(q, `${insight.content} ${(insight.relatedConcepts || []).join(' ')}`)
        + utils.clamp(insight.importance, 0, 1, 0.5) * 0.25
        + utils.clamp(insight.confidence, 0, 1, 0.6) * 0.15
    }))
    .filter(entry => !q || entry.score > 0.12)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(entry => ({ ...entry.insight, relevanceScore: Number(entry.score.toFixed(3)) }));
}

async function deleteInsight(userId, insightId, services = {}) {
  const state = await hydrateInsightsFromStorage(userId, services);
  const before = state.insights.length;
  state.insights = state.insights.filter(insight => insight.id !== insightId);
  if (before === state.insights.length) return { ok: false, reason: 'INSIGHT_NOT_FOUND' };
  legacyGuards.touchState(state);
  legacyGuards.persistAsync(services);
  await mirrorInsightsToStorage(userId, state, services);
  return { ok: true, deleted: insightId };
}

async function getInsightStats(userId, services = {}) {
  const state = await hydrateInsightsFromStorage(userId, services);
  const total = state.insights.length;
  const avgConfidence = total
    ? state.insights.reduce((sum, item) => sum + utils.clamp(item.confidence, 0, 1, 0.6), 0) / total
    : 0;
  return {
    total,
    averageConfidence: Number(avgConfidence.toFixed(3))
  };
}

async function hydrateInsightsFromStorage(userId, services = {}) {
  const state = legacyGuards.ensureAIOSState(userId, services);
  if (!services.storageManager?.loadData) return state;
  try {
    const stored = await utils.loadUserBucket(STORAGE_KEY, userId, services, []);
    if (stored.length && !state.insights.length) {
      state.insights = guards.enforceInsightLimit(stored);
      legacyGuards.touchState(state);
    }
  } catch (_) {}
  return state;
}

async function mirrorInsightsToStorage(userId, state, services = {}) {
  if (!services.storageManager?.saveData) return false;
  try {
    const safe = guards.enforceInsightLimit(guards.safeJsonArray(state.insights));
    state.insights = safe;
    return await utils.saveUserBucket(STORAGE_KEY, userId, safe, services);
  } catch (_) {
    return false;
  }
}

module.exports = {
  STORAGE_KEY,
  createInsight,
  listInsights,
  searchInsights,
  deleteInsight,
  getInsightStats,
  hydrateInsightsFromStorage,
  mirrorInsightsToStorage
};
