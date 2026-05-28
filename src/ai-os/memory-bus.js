'use strict';

const guards = require('./guards');
const unifiedMemory = require('./unified-memory');

function publish(userId, event = {}, botServices) {
  const type = event.type || 'semantic';
  const content = event.content || event.text || event.summary || '';
  const tags = guards.uniqueList([...(event.tags || []), event.channel || event.topic || type], 14);
  return unifiedMemory.addMemory(userId, {
    type,
    content,
    tags,
    source: event.source || 'memory-bus',
    confidence: event.confidence ?? 0.65,
    importance: event.importance ?? scoreImportance(content, type)
  }, botServices);
}

function retrieve(userId, query = '', options = {}, botServices) {
  return unifiedMemory.searchMemory(userId, query, options, botServices);
}

function update(userId, memoryId, patch = {}, botServices) {
  return unifiedMemory.updateMemory(userId, memoryId, patch, botServices);
}

function prune(userId, options = {}, botServices) {
  return unifiedMemory.pruneMemory(userId, options, botServices);
}

function scoreImportance(content, type = 'semantic') {
  return guards.importanceFromText(content, type);
}

function publishInsight(userId, insight, botServices, options = {}) {
  const state = guards.ensureAIOSState(userId, botServices);
  const clean = guards.sanitizeText(insight, 600);
  if (!clean) return { ok: false, reason: 'EMPTY_INSIGHT' };

  const entry = {
    id: guards.stableId('insight', clean),
    userId: guards.normalizeUserId(userId),
    text: clean,
    source: options.source || 'ai-os',
    confidence: guards.clamp01(options.confidence, 0.7),
    importance: guards.clamp01(options.importance ?? guards.importanceFromText(clean, 'insight'), 0.65),
    tags: guards.uniqueList(options.tags || ['insight'], 10),
    createdAt: guards.nowIso()
  };

  const exists = state.insights.some((item) => guards.compactText(item.text, 180).toLowerCase() === guards.compactText(entry.text, 180).toLowerCase());
  if (!exists) state.insights.push(entry);
  state.insights = guards.pruneListByScore(state.insights, guards.DEFAULT_LIMITS.insights, (item) => {
    return (item.importance || 0.5) + (item.confidence || 0.5) * 0.4 + (Date.parse(item.createdAt || 0) || 0) / Date.now() * 0.1;
  });

  publish(userId, {
    type: 'insight',
    content: clean,
    tags: entry.tags,
    source: entry.source,
    confidence: entry.confidence,
    importance: entry.importance
  }, botServices);

  guards.touchState(state);
  guards.persistAsync(botServices);
  return { ok: true, insight: entry, deduped: exists };
}

function getRecentInsights(userId, botServices, limit = 5) {
  const state = guards.ensureAIOSState(userId, botServices);
  return guards.safeArray(state.insights)
    .sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0))
    .slice(0, Math.max(1, Math.min(limit, 12)));
}

function reset(userId, botServices) {
  const state = guards.ensureAIOSState(userId, botServices);
  state.memories = [];
  state.insights = [];
  guards.touchState(state);
  guards.persistAsync(botServices);
  return { ok: true };
}

module.exports = {
  publish,
  retrieve,
  update,
  prune,
  scoreImportance,
  publishInsight,
  getRecentInsights,
  reset
};
