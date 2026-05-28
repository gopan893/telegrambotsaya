'use strict';

const utils = require('./aios-utils');

const LIMITS = {
  memories: 300,
  goals: 50,
  workflows: 100,
  workflowSteps: 50,
  insights: 200,
  inputChars: 1800
};

const MEMORY_TYPES = new Set([
  'semantic',
  'episodic',
  'project',
  'coding_preference',
  'correction',
  'learning',
  'strategic',
  'reflection',
  'insight',
  'workflow',
  'goal'
]);

const STATUSES = new Set(['active', 'paused', 'completed', 'archived']);
const PRIORITIES = new Set(['low', 'medium', 'high']);

function sanitizeUserText(text = '', max = LIMITS.inputChars) {
  return String(text || '')
    .replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function preventHugeInput(text = '', max = LIMITS.inputChars) {
  const raw = String(text || '');
  if (raw.length > max) {
    return {
      ok: false,
      reason: `Input terlalu panjang. Batasi maksimal ${max} karakter.`
    };
  }
  return { ok: true };
}

function safeJsonArray(value) {
  return Array.isArray(value) ? value : [];
}

function validatePriority(value = 'medium') {
  const clean = sanitizeUserText(value, 40).toLowerCase();
  if (['tinggi', 'urgent', 'penting'].includes(clean)) return 'high';
  if (['rendah', 'nanti'].includes(clean)) return 'low';
  return PRIORITIES.has(clean) ? clean : 'medium';
}

function validateStatus(value = 'active') {
  const clean = sanitizeUserText(value, 40).toLowerCase();
  return STATUSES.has(clean) ? clean : 'active';
}

function enforceMemoryLimit(items = []) {
  return pruneByScore(items, LIMITS.memories, scoreMemoryLike);
}

function enforceGoalLimit(items = []) {
  return pruneByScore(items, LIMITS.goals, item => {
    const priority = item.priority === 'high' ? 0.35 : item.priority === 'medium' ? 0.22 : 0.1;
    const active = item.status === 'active' ? 0.3 : item.status === 'paused' ? 0.12 : 0;
    const progress = 0.18 * (1 - utils.clamp(item.progress, 0, 100, 0) / 100);
    return priority + active + progress + recencyScore(item.updatedAt || item.createdAt);
  });
}

function enforceWorkflowLimit(items = []) {
  return pruneByScore(items, LIMITS.workflows, item => {
    const active = item.status === 'active' ? 0.34 : item.status === 'paused' ? 0.12 : 0;
    const steps = safeJsonArray(item.steps);
    const done = steps.filter(step => step.done).length;
    const remaining = steps.length ? 0.2 * (1 - done / steps.length) : 0.12;
    return active + remaining + recencyScore(item.lastActivityAt || item.updatedAt || item.createdAt);
  });
}

function enforceInsightLimit(items = []) {
  return pruneByScore(items, LIMITS.insights, scoreMemoryLike);
}

function scoreMemoryLike(item = {}) {
  return utils.clamp(item.importance, 0, 1, 0.5) * 0.45
    + utils.clamp(item.confidence, 0, 1, 0.6) * 0.25
    + recencyScore(item.lastAccessedAt || item.updatedAt || item.createdAt);
}

function recencyScore(iso) {
  const ts = Date.parse(iso || '');
  if (!ts) return 0.08;
  const ageDays = Math.max(0, (Date.now() - ts) / (24 * 60 * 60 * 1000));
  return Math.max(0, 0.3 - ageDays / 180);
}

function pruneByScore(items, limit, scorer) {
  const list = safeJsonArray(items);
  if (list.length <= limit) return list;
  return list
    .map(item => ({ item, score: scorer(item) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(entry => entry.item);
}

module.exports = {
  LIMITS,
  MEMORY_TYPES,
  PRIORITIES,
  STATUSES,
  enforceGoalLimit,
  enforceInsightLimit,
  enforceMemoryLimit,
  enforceWorkflowLimit,
  preventHugeInput,
  safeJsonArray,
  sanitizeUserText,
  validatePriority,
  validateStatus
};
